"use strict";

var util = require("./util");
var Selection = require("./Selection");
var Watches = require("./Watches");

var api = function SelectionCreator(globs, location, pwd) { 
    return new Selection(globs, location, pwd); 
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

    copy: function copy(options) {
        return api(options).copy(options);
    },

    delete: function deleteFiles(options) {
        return api(options).delete(options);
    },

    watch: function watch(options, callback) {
        if (!arguments.length) {
            watch.play();
            return api;
        }

        var selection = api(options);
        return selection.watch(callback, options);
    },

    pause: function pause() {
        watch.pause();
        return api;
    },

    stop: function stop() {
        watch.unregister();  
        return api;
    }

});

module.exports = api;