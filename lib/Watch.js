'use strict';

var path = require("path");
var fs = require("fs");
var util = require("./util");

class Watch {

    constructor(selector, options) {

        this.selector = selector;

        if (!this.selector.stat.exists) {
            throw "Cannot watch non-existent location: " + this.selector.location;
        }

        this.isPaused = false;
        
        this.options = util.defaults(options, {
            duration: 2000
        });

        this.changes = {};

        //light debounce as directory deletes tend to trigger multiple events
        this.change = util.debounce(this.change.bind(this), 17); 
        this.trigger = util.debounce(this.trigger.bind(this), this.options.duration);
        
        this.attachWatcher();

    }

    attachWatcher() {

        var onChange = function onChange(type, relativePath) {

            var relativePath = util.posix(relativePath);
            var isMatched = this.selector.match(relativePath);
            if (!isMatched) return;

            this.hasChanged = true;

            if (this.isPaused) return;

            this.cancelCurrentChanges();
            this.change();        

        }.bind(this);

        switch(process.platform) {
            case "linux":

                // linux inotify isn't recursive
                this.watchers = [];

                var selector = new util.Selection(this.selector, this.selector.location);
                selector.stats({
                    // as inotify alerts when files in the watched directory change 
                    // we only need to watch all sub- directories
                    dirs: true,
                    files: false,
                    includeParentDirs: true,
                    sync: true
                }).then(function(stats) {

                    //attach watcher for root
                    this.watchers.push(fs.watch(this.selector.location, {
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
                this.watcher = fs.watch(this.selector.location, {
                    persistent: true,
                    recursive: true
                }, onChange);
        }

        

    }

    detachWatcher() {

        this.cancelCurrentChanges();

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

    trigger() {

        this.inWatch = true;
        this.detachWatcher();

        var result = new util.Stats(this.selector, this.options);
        var keys = Object.keys(this.changes);
        keys.sort();
        for (var i = 0, l = keys.length; i < l; i++) {
            var k = keys[i];
            result.push(this.changes[k]);
        }
        this.changes = {};

        this.selector.watches.each(function(watch, nextWatch) {

            if (!watch) {
                this.hasChanged = false;
                this.inWatch = false;
                this.attachWatcher();
                this.change();
                return;
            }

            watch.callback(result);

            nextWatch();

        }.bind(this));

    }

    cancelCurrentChanges() {

        if (!this.statsOptions) return;

        this.statsOptions.cancel = true;
        this.trigger.cancel();

        this.statsOptions = null;

    }

    change() {

        if (this.isPaused) return;

        this.statsOptions = util.extend({}, this.options, {
            sync: false,
            update: true,
            cancel: false
        });

        this.selector.stats(this.statsOptions)
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

    pause() {
        this.isPaused = true;
    }

    play() {
        var wasPaused = this.isPaused;
        this.isPaused = false;
        if (wasPaused && this.hasChanged) {
            this.change();
        }
    }

    destroy() {

        delete this.selector;
        delete this.options;
        delete this.trigger;
        delete this.change;

        this.detachWatcher();

    }

}

module.exports = util.Watch = Watch;