"use strict";

var util = require("./lib/util");
var Globs = require("./lib/Globs");
var Stat = require("./lib/Stat");
var Stats = require("./lib/Stats");
var Watch = require("./lib/Watch");
var Watches = require("./lib/Watches");

var api = function GlobsCreator(globs, location, pwd) {
    return new Globs(globs, location, pwd); 
};

util.extend(api, {

    watches: util.watches,

    posix: util.posix,
    mkdir: util.mkdir,
    abs: util.abs,
    rel: util.rel,
    home: util.home,
    cwd: util.cwd,
    norm: util.norm,
    join: util.join,
    stat: util.stat,

    stats: function stats(options) {
        return api(options).stats(options);
    },

    collate: function collate(options) {
        return api(options).collate(options);
    },

    move: function move(options) {
        return api(options).move(options);
    },

    copy: function copy(options) {
        return api(options).copy(options);
    },

    delete: function deleteFiles(options) {
        return api(options).delete(options);
    },

    watch: function watch(options, callback) {
        if (arguments.length < 2) {
            throw "fs-glob.watch: requires at least 2 arguments";
            return undefined;
        }

        var globs = api(options);
        return globs.watch(callback, options);
    },

    play: function() {
        api.watches.play();
        return api;
    },

    pause: function pause() {
        api.watches.pause();
        return api;
    },

    stop: function stop() {
        api.watches.unregister();  
        return api;
    }

});

module.exports = api;