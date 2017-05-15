'use strict';

var util = require("./util");
var path = require("path");
var fs = require("fs");
var Stack = require("./Stack");
var Stats = require("./Stats");

class Stat {

    constructor(location, dontUpdate) {

        if (dontUpdate) return;

        this.location = util.abs(location);

        this.update();

        this.basename = path.basename(this.location);

        if (this.isFile) {
            this.filename = path.basename(this.location, this.extname);
            this.extname = path.extname(this.location);
        } else {
            this.filename = null;
            this.extname = null;
        }

        this.dirname = path.dirname(this.location);

    }

    update(options) {

        if (options && !options.update && this.timestamp && eval(options.updateFrom) < this.timestamp) {
            return;
        }

        this.timestamp = Date.now();
        this.children = null;

        if (!fs.existsSync(this.location)) {

            this.birthtime = null;
            this.ctime = null;
            this.mtime = null;
            this.size = null;
            this.isDir = null;
            this.isFile = null;
            this.exists = false;

        } else {

            var stat = fs.statSync(this.location);

            this.birthtime = stat.birthtime.getTime();
            this.ctime = stat.ctime.getTime();
            this.mtime = stat.mtime.getTime();
            this.size = stat.size;
            this.exists = true;

            if (stat.isFile()) {
                this.isDir = false;
                this.isFile = true;
            } else if (stat.isDirectory()) {
                this.isDir = true;
                this.isFile = false;
            }

        }

    }

    getChildren(options) {

        if (!this.isDir) {
            return this.children = null;
        }

        if (options && !options.update && this.children && eval(options.updateFrom) < this.timestamp) {
            return this.children;
        }

        this.children = [];

        var list = fs.readdirSync(this.location);

        for (var i = 0, l = list.length; i < l; i++) {

            var subitem = list[i];
            var fullpath = util.join(this.location, subitem);

            var subitemStat = util.stat(fullpath, options);

            this.children.push(subitemStat);

        }

        return this.children;

    }

    clone(cloneHash) {

        cloneHash = cloneHash || {};

        if (cloneHash[this.location]) {
            return cloneHash[this.location];
        }

        var stat = new Stat("", true);
        for (var k in this) {

            if (k === "children") {
                continue;
            }
            
            stat[k] = this[k];

        }

        if (this.children) {
            var childrenClone = stat.children = new Array(this.children.length);
            for (var i = 0, l = this.children.length; i < l; i++) {
                if (cloneHash[this.children[i].location]) {
                    childrenClone[i] = cloneHash[this.children[i].location];
                } else {
                    childrenClone[i] = cloneHash[this.children[i].location] = this.children[i].clone();
                }
            }
        }

        return stat;

    }

    walk(selected, options, callback) {

        return new Promise(function walkPromise(resolve, reject) {

            var stat = util.stat(selected.location, options);

            var stack = new Stack(stat);
            var walked = new Stats(selected);
            var parentDirs = {};

            stack.each(function stackNext(item, next) {

                if (!item) {

                    if (!callback) {
                        resolve(walked.clone());
                    } else {
                        callback(resolve, reject, walked);
                    }

                    return;
                }

                if (!item.isDir) {
                    return next();
                }

                var children = item.getChildren(options);
                for (var i = 0, l = children.length; i < l; i++) {

                    var subitemStat = children[i];
                    var relativePath = util.rel(subitemStat.location, selected.location);

                    var isMatched = selected.match(relativePath);
                    var capture = (subitemStat.isDir && options.dirs) || (subitemStat.isFile && options.files);

                    switch (isMatched) {
                        case 2:
                            if (options.includeParentDirs && !parentDirs[item.location]) {
                                parentDirs[item.location] = true;
                                walked.push(item);
                            }
                            if (capture) {
                                walked.push(subitemStat);
                                if (options.includeParentDirs && subitemStat.isDir && !parentDirs[subitemStat.location]) {
                                    parentDirs[subitemStat.location] = true;
                                }
                            }
                        case 1:
                            if (subitemStat.isDir) {
                                stack.push(subitemStat);
                            }
                    }


                }

                next();

            }, options);

        });

    }

}

util.Stat = Stat;

module.exports = Stat;