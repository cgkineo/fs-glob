'use strict';

var path = require("path");
var fs = require("fs");
var util = require("./util");
var MATCH = require("./MATCH");

class Watch {

    constructor(globs, options) {

        this.globs = globs;

        if (!this.globs.stat.exists) {
            throw "Watch: cannot watch non-existent location: " + this.globs.location;
        }

        this.isPaused = false;
        
        this.options = util.defaults(options, {
            interval: 2000
        });

        this.changes = {};

        //light debounce as directory deletes tend to trigger multiple events
        this.change = util.debounce(this.change.bind(this), 17);
        this.trigger = util.debounce(this.trigger.bind(this), this.options.interval);
        
        this.attach();

    }

    attach() {

        var onChange = function onChange(type, relativePath) {

            var relativePath = util.posix(relativePath);
            var isMatched = this.globs.match(relativePath);
            if (isMatched === MATCH.NEGATE) return;

            this.hasChanged = true;

            if (this.isPaused) return;

            this.change();        

        }.bind(this);

        switch(process.platform) {
            case "linux":

                // linux inotify isn't recursive
                this.watchers = [];

                var globs = new util.Globs(this.globs, this.globs.location);
                globs.stats({
                    // as inotify alerts when files in the watched directory change 
                    // we only need to watch all sub- directories
                    dirs: true,
                    files: false,
                    includeParentDirs: true,
                    sync: true
                }).then(function(stats) {

                    //attach watcher for root
                    this.watchers.push(fs.watch(this.globs.location, {
                        persistent: true
                    }, onChange));

                    //attach watcher for each sub directory matching the globs
                    for (var i = 0, l = stats.length; i < l; i++) {
                        this.watchers.push(fs.watch(stats[i].location, {
                            persistent: true
                        }, onChange))
                    }
                    
                }.bind(this));

                break;
            default:

                // windows is recursive
                // osx is recursive
                this.watcher = fs.watch(this.globs.location, {
                    persistent: true,
                    recursive: true
                }, onChange);
        }

        

    }

    change() {

        if (this.isPaused) return;

        this.cancel();

        this.statsOptions = util.extend({}, this.options, {
            sync: false,
            force: true,
            cancel: false
        });

        this.globs.stats(this.statsOptions)
        .then(function(stats) {

            if (this.isPaused) return;

            if (stats.options.cancel) {
                return;
            }
            
            if (!this.previous) {
                this.previous = util.groupby(stats, "location");
                return;
            }

            var groupedStats = util.groupby(stats, "location");

            var lr = util.leftright(this.previous, groupedStats, function(a, b) {
                var parsed = path.parse(a.location);
                if (!b.exists && a.exists) {
                    return -2;
                }
                if (!a.exists && b.exists) {
                    return 2;
                }
                if (!a.exists && !b.exists) {
                    return 0;
                }
                if (b.mtime === a.mtime) {
                    return 0;
                }
                var isBNewer = (b.mtime > a.mtime);
                if (isBNewer) return 1;
                return -1;
            });

            if (!lr) {
                this.previous = groupedStats;
                return;
            }

            for (var k in lr) {

                switch (lr[k]) {
                    case 1: case -1: // one of the files in newer
                        groupedStats[k].change = "changed";
                        groupedStats[k].previous = this.previous[k];
                        this.changes[k] = groupedStats[k];
                        break;
                    case -2: // the file exists only on the left
                        this.previous[k].change = "deleted";
                        this.changes[k] = this.previous[k];
                        break;
                    case 2: // the file exists only on the right
                        groupedStats[k].change = "added";
                        this.changes[k] = groupedStats[k];
                        break;
                }

            }

            this.previous = groupedStats;
            
            this.trigger();

        }.bind(this));

    }

    trigger() {

        this.inWatch = true;
        this.detach();

        var result = new util.Stats(this.globs, this.options);
        var keys = Object.keys(this.changes);
        keys.sort();
        for (var i = 0, l = keys.length; i < l; i++) {
            var k = keys[i];
            result.push(this.changes[k]);
        }
        this.changes = {};

        if (this.isPaused) return;

        this.globs.watches.each(function(watch, nextWatch) {

            if (this.isPaused) return;

            if (!watch) {
                this.hasChanged = false;
                this.inWatch = false;
                this.attach();
                this.change();
                return;
            }

            watch.options.callback(result);

            nextWatch();

        }.bind(this));

    }

    cancel() {

        if (!this.statsOptions) return;

        this.statsOptions.cancel = true;
        this.trigger.cancel();

        this.statsOptions = null;

    }

    pause() {
        this.isPaused = true;
    }

    clear() {
        this.previous = null;
        this.hasChanged = true;
    }

    play() {
        var wasPaused = this.isPaused;
        this.isPaused = false;
        if (wasPaused && this.hasChanged) {
            this.change();
        }
    }

    detach() {

        this.cancel();

        switch(process.platform) {
            case "linux":

                if (!this.watchers || this.watchers.length === 0) return;

                for (var i = 0, l = this.watchers.length; i < l; i++) {
                    this.watchers[i].close();
                }

                break;

            default:
                if (!this.watcher) return;
                this.watcher.close();
        }
        
    }

    destroy() {

        delete this.globs;
        delete this.options;
        delete this.trigger;
        delete this.change;

        this.detach();

    }

}

module.exports = util.Watch = Watch;