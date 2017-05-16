'use strict';

var path = require("path");
var fs = require("fs");
var util = require("./util");
var Stats = require("./Stats");

class Watch {

    constructor(parent, selector, options) {
        this.parent = parent;
        this.selector = selector;
        this.options = util.defaults(options, {
            duration: 2000
        });
        this.changes = {};
        this.change = util.debounce(this.change.bind(this), 17); //light debounce as directory deletes tend to trigger multiple events
        this.onChange = this.onChange.bind(this);
        this.trigger = util.debounce(this.trigger.bind(this), this.options.duration);
        this.attachWatcher();
    }

    attachWatcher() {
        this.watcher = fs.watch(this.selector.location, {
            persistent: true,
            recursive: true
        }, this.onChange);
    }

    detachWatcher() {
        this.watcher.close();
    }

    trigger() {

        this.inWatch = true;
        this.detachWatcher();

        var result = new Stats(this.selector, this.options);
        for (var k in this.changes) {
            result.push(this.changes[k]);
        }
        this.changes = {};

        this.selector.watches.each(function(watch, nextWatch) {

            if (!watch) {
                this.inWatch = false;
                this.attachWatcher();
                this.onChange();
                return;
            }

            watch.callback(result);

            nextWatch();

        }.bind(this));

    }

    isInWatch() {
        return this.inWatch;
    }

    cancel() {

        if (!this.statsOptions) return;

        this.statsOptions.cancel = true;
        this.trigger.cancel();

        this.statsOptions = null;

    }

    onChange() {

        this.cancel();

        this.change();        

    }

    change() {

        this.statsOptions = util.extend({}, this.options, {
            sync: false,
            update: true,
            cancel: false
        });

        this.selector.stats(this.statsOptions)
        .then(function(stats) {

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

}

module.exports = Watch;