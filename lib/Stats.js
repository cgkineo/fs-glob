'use strict';

var ASyncIterator = require("./ASyncIterator");
var fs = require("fs");
var path = require("path");
var util = require("./util");

class Stats extends ASyncIterator {

    constructor(selector, options) {
        super();
        this.selector = selector;
        this.options = options;
    }

    pluck(name) {

        var plucked = new Array(this.length);
        for (var i = 0, l = this.length; i < l; i++) {
            plucked[i] = this[i][name];
        }

        return plucked;

    }

    filter(on, by) {

        var onType = (typeof on);
        var byType = (typeof by);

        var result = new util.Stats(this.selector, this.options);

        if (byType === "undefined") {

            switch(onType) {
            case "function":
                for (var i = 0, l = this.length; i < l; i++) {
                    if (on(this[i])) {
                        result.push(this[i]);
                    }
                }
                return result;
            case "object":
                for (var i = 0, l = this.length; i < l; i++) {
                    var equal = true;
                    for (var k in on) {
                        if (this[i][k] !== on[k]) {
                            equal = false;
                            break;
                        }
                    }
                    if (equal) {
                        result.push(this[i]);
                    }
                }
                return result;
            case "string":
                for (var i = 0, l = this.length; i < l; i++) {
                    if (this[i] === by) {
                        result.push(this[i]);
                    }
                }
                return result;
            }

        }

        if (onType === "string") {

            switch(byType) {
            case "function":
                for (var i = 0, l = this.length; i < l; i++) {
                    if (by(this[i][on])) {
                        result.push(this[i]);
                    }
                }
                return result;
            case "object":
                for (var i = 0, l = this.length; i < l; i++) {
                    var equal = true;
                    for (var k in by) {
                        if (this[i][on][k] !== by[k]) {
                            equal = false;
                            break;
                        }
                    }
                    if (equal) {
                        result.push(this[i]);
                    }
                }
                return result;
            case "string":
                for (var i = 0, l = this.length; i < l; i++) {
                    if (this[i][on] === by) {
                        result.push(this[i]);
                    }
                }
                return result;
            }
            
        }

        return this;

    }

    clone() {

        var cloneHash = {};

        var clone = new util.Stats(this.selector, this.options);
        for (var i = 0, l = this.length; i < l; i++) {
            clone.push(this[i].clone(cloneHash));
        }

        return clone;
    }

    update(options) {

        for (var i = 0, l = this.length; i < l; i++) {
            this[i].update(options);
        }

        return this;

    }

    copy(to, options) {
        
        var options = util.parseArguments(arguments, ["to", "options"]);
        options = util.defaults(options, {
            overwriteOlder: true,
            overwriteSame: false,
            overwriteNewer: false,
            force: false,
            files: true, 
            dirs: true,
            includeParentDirs: true,
            timestamp: Date.now()
        });

        options.to = util.abs(options.to, this.location);
        util.mkdir(options.to);

        return new Promise(function copyPromise(resolve, reject) {

            this.each(function copyNext(item, next) {

                if (!item) {
                    resolve(this);
                    return;
                }

                var relativeDir = util.rel(item.location, this.location);
                var toDestination = util.join( options.to, relativeDir );

                if (!options.force) {
                    var existing = new util.Stat(toDestination);
                    if (existing.exists) {
                        var isNewer = (existing.mtime > item.mtime);
                        var isSame = (existing.mtime === item.mtime && existing.size === item.size);
                        var isOlder = (existing.mtime < item.mtime);
                        if (isNewer && !options.overwriteNewer) {
                            return next(false);
                        } else if (isSame && !options.overwriteSame) {
                            return next(false);
                        } else if (isOlder && !options.overwriteOlder) {
                            return next(false);
                        }
                    }
                }

                if (item.isDir) {
                    util.mkdir(toDestination, this.location);
                    return next();
                } else if (options.sync || options.syncCopy) {
                    fs.writeFileSync(toDestination, fs.readFileSync(item.location));
                    return next();
                } else {
                    var read = fs.createReadStream(item.location);
                    read.on("error", function(err) {
                        reject(err);
                    });
                    var write = fs.createWriteStream(toDestination);
                    write.on("error", function(err) {
                        reject(err);
                    });
                    write.on("close", function(ex) {
                        next();
                    });
                    read.pipe(write);
                }

            }.bind(this), options);

        }.bind(this));

    }

    collate(on, to, options) {

        var options = util.parseArguments(arguments, ["on", "to", "options"]);
        options = util.defaults(options, {
            overwriteOlder: true,
            overwriteSame: false,
            overwriteNewer: false,
            force: false,
            files: true,
            dirs: true,
            includeParentDirs: true,
            timestamp: Date.now(),
        });

        options.to = util.abs(options.to, this.location);
        util.mkdir(options.to);

        if (!options.on) {
            throw "No on defined";
        }
        if (options.on.substr(0,1) === "/") options.on = options.on.substr(1);

        return new Promise(function collatePromise(resolve, reject) {

            this.each(function collateNext(item, next) {

                if (!item) {
                    return resolve(this);
                }

                var relativeLocation = util.rel(item.location, this.location);
                var lastIndexOccurance = relativeLocation.lastIndexOf(options.on);
                if (lastIndexOccurance === -1) {
                    return next(false);
                }

                var truncated = relativeLocation.substr(relativeLocation.lastIndexOf(options.on)+options.on.length);
                var toDestination = util.join( options.to, truncated );

                if (!options.force) {
                    var existing = new util.Stat(toDestination);
                    if (existing.exists) {
                        var isNewer = (existing.mtime > item.mtime);
                        var isSame = (existing.mtime === item.mtime && existing.size === item.size);
                        var isOlder = (existing.mtime < item.mtime);
                        if (isNewer && !options.overwriteNewer) {
                            return next(false);
                        } else if (isSame && !options.overwriteSame) {
                            return next(false);
                        } else if (isOlder && !options.overwriteOlder) {
                            return next(false);
                        }
                    }
                }

                if (item.isDir) {

                    util.mkdir(toDestination, this.location);
                    return next();

                } else if (options.sync || options.syncCopy) {

                    fs.writeFileSync(toDestination, fs.readFileSync(item.location));
                    return next();

                } else {

                    var read = fs.createReadStream(item.location);
                    read.on("error", function(err) {
                        reject(err);
                    });
                    var write = fs.createWriteStream(toDestination);
                    write.on("error", function(err) {
                        reject(err);
                    });
                    write.on("close", function(ex) {
                        next();
                    });
                    read.pipe(write);

                }

            }.bind(this));

        }.bind(this));

    }

    delete() {

        return new Promise(function deletePromise(resolve, reject) {

            this.reverseEach(function deletesNext(item, next) {

                if (!item) {
                    resolve(this);
                    return;
                }

                try {
                    if (item.isDir) {
                        fs.rmdirSync(item.location);
                    } else if (item.isFile) {
                        fs.unlinkSync(item.location);
                    }
                } catch(e) {}

                next();

            }.bind(this));

        }.bind(this));

    }

}

module.exports = util.Stats = Stats;