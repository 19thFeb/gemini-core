'use strict';

const globExtra = require('glob-extra');
const _ = require('lodash');
const Promise = require('bluebird');

const SetCollection = require('./set-collection');
const TestSet = require('./test-set');

const EXPAND_OPTS = {formats: ['.js']};

module.exports = class SetsBuilder {
    static create(sets, opts) {
        return new SetsBuilder(sets, opts);
    }

    constructor(sets, opts) {
        this._sets = _.mapValues(sets, (set) => TestSet.create(set));
        this._defaultDir = opts.defaultDir;

        this._filesToUse = this._hasFiles() ? [] : [this._defaultDir];
    }

    useSets(setsToUse) {
        this._validateUnknownSets(setsToUse);

        if (!_.isEmpty(setsToUse)) {
            this._sets = _.pick(this._sets, setsToUse);
        }

        return this;
    }

    _validateUnknownSets(setsToUse) {
        const setsNames = _.keys(this._sets);
        const unknownSets = _.difference(setsToUse, setsNames);

        if (_.isEmpty(unknownSets)) {
            return;
        }

        let error = `No such sets: ${unknownSets.join(', ')}.`;

        if (!_.isEmpty(setsNames)) {
            error += ` Use one of the specified sets: ${setsNames.join(', ')}`;
        }

        throw new Error(error);
    }

    useFiles(files) {
        if (!_.isEmpty(files)) {
            this._filesToUse = files;
        }

        return this;
    }

    useBrowsers(browsers) {
        _.forEach(this._sets, (set) => set.useBrowsers(browsers));

        return this;
    }

    build(projectRoot, globOpts) {
        globOpts = globOpts || {};

        return this._transformDirsToMasks()
            .then(() => globExtra.expandPaths(this._filesToUse, EXPAND_OPTS, globOpts))
            .then((expandedFiles) => this._useFiles(expandedFiles))
            .then(() => this._expandFiles(_.extend(EXPAND_OPTS, {root: projectRoot}), globOpts))
            .then(() => SetCollection.create(this._sets));
    }

    _transformDirsToMasks() {
        return Promise.map(this._getSets(), (set) => set.transformDirsToMasks());
    }

    _getSets() {
        return _.values(this._sets);
    }

    _useFiles(filesToUse) {
        _.forEach(this._sets, (set) => set.useFiles(filesToUse));

        if (!this._hasFiles()) {
            throw new Error('Cannot find files by masks in sets');
        }
    }

    _expandFiles(expandOpts, globOpts) {
        return Promise.map(this._getSets(), (set) => set.expandFiles(expandOpts, globOpts));
    }

    _hasFiles() {
        return _.some(this._sets, (set) => !_.isEmpty(set.getFiles()));
    }
};