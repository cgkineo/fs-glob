'use strict';

var path = require("path");
var fs = require("fs");
var util = require("./util");

class Watch {

    constructor(parent, selector, options) {
        this.parent = parent;
        this.selector = selector;
        this.options = util.defaults(options, {
            waitDuration: 2000
        });
        this.changed = [];
        this.deleted = [];
        this.added = [];
        this.onChange = this.onChange.bind(this);
        this.trigger = util.debounce(this.trigger.bind(this), this.options.waitDuration);
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
        this.detachWatcher()

        this.selector.watches.each(function(watch, nextWatch) {

            if (!watch) {
                this.changed.length = 0;
                this.deleted.length = 0;
                this.added.length = 0;
                this.inWatch = false;
                this.attachWatcher();
                this.onChange();
                return;
            }

            watch.callback({
                changed: this.changed,
                delete: this.deleted,
                added: this.added
            });

            nextWatch();

        }.bind(this));

    }

    isInWatch() {
        return this.inWatch;
    }

    onChange() {

        var options = {
            sync: false,
            update: true
        };

        this.selector.stats(options)
        .then(function(stats) {
            
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
                    this.changed.push(groupedStats[k]);
                    break;
                case -2: // the file exists only on the left
                    this.deleted.push(this.previous[k]);
                    break;
                case 2: // the file exists only on the right
                    this.added.push(groupedStats[k]);
                    break;
                }
            }

            this.previous = groupedStats;
            
            this.trigger();

        }.bind(this));

    }

}

module.exports = Watch;