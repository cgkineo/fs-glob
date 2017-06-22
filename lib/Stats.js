'use strict';

var ASyncIterator = require("./ASyncIterator");
var fs = require("fs");
var path = require("path");
var util = require("./util");

class Stats extends ASyncIterator {

    constructor(globs, options) {
        super();
        this.globs = globs;
        this.options = options;
    }

    pluck(by) {

        var plucked = [];

        switch (typeof by) {
            case "function":

                for (var i = 0, l = this.length; i < l; i++) {
                    var value = by(this[i]);
                    if (value === undefined) continue;
                    plucked.push(value);
                }
                break;

            case "string":

                for (var i = 0, l = this.length; i < l; i++) {
                    var value = this[i][by];
                    if (value === undefined) continue;
                    plucked.push(value);
                }
                break;
                
        }
        
        return plucked;

    }

    filter(at, by) {

        var atType = (typeof at);
        var byType = (typeof by);

        var result = new util.Stats(this.globs, this.options);

        if (byType === "undefined") {

            switch(atType) {
                case "function":

                    for (var i = 0, l = this.length; i < l; i++) {
                        if (at(this[i])) {
                            result.push(this[i]);
                        }
                    }
                    return result;

                case "object":

                    for (var i = 0, l = this.length; i < l; i++) {
                        var equal = true;
                        for (var k in at) {
                            if (this[i][k] !== at[k]) {
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

        if (atType === "string") {

            switch(byType) {
                case "function":

                    for (var i = 0, l = this.length; i < l; i++) {
                        if (by(this[i][at])) {
                            result.push(this[i]);
                        }
                    }
                    return result;

                case "object":

                    for (var i = 0, l = this.length; i < l; i++) {
                        var equal = true;
                        for (var k in by) {
                            if (this[i][at][k] !== by[k]) {
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
                        if (this[i][at] === by) {
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

        var clone = new util.Stats(this.globs, this.options);
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

    move(to, options) {

        var options = util.parseArguments(arguments, ["to", "options"],  [["undefined|object"], ["undefined|string", "object"]], "Stats.move");
        options = util.defaults(options, {
            overwriteOlder: true,
            overwriteSame: false,
            overwriteNewer: false,
            force: false,
            files: true, 
            dirs: true,
            sync: false,
            syncCopy: false,
            includeParentDirs: true,
            timestamp: Date.now()
        });

        options.to = util.abs(options.to, this.globs.location);
        util.mkdir(options.to);
        
        return this.copy(options).then(function(copied) {
            return copied.delete(options);
        });

    }

    copy(to, options) {
        
        var options = util.parseArguments(arguments, ["to", "options"],  [["undefined|object"], ["undefined|string", "object"]], "Stats.copy");
        options = util.defaults(options, {
            overwriteOlder: true,
            overwriteSame: false,
            overwriteNewer: false,
            force: false,
            files: true, 
            dirs: true,
            sync: false,
            syncCopy: false,
            includeParentDirs: true,
            timestamp: Date.now()
        });

        options.to = util.abs(options.to, this.globs.location);
        util.mkdir(options.to);

        return new Promise(function copyPromise(resolve, reject) {

            var cloned = this.clone();

            cloned.each(function copyNext(item, next) {

                if (!item) {
                    resolve(this);
                    return;
                }

                console.log(this.globs.location);

                var relativeDir = util.rel(item.location, this.globs.location);
                var toDestination = util.join( options.to, relativeDir );

                if (!options.force) {
                    var existing = new util.Stat(toDestination);
                    if (existing.exists) {
                        var isNewer = (existing.mtime > item.mtime);
                        var isSame = (existing.mtime === item.mtime && existing.size === item.size);
                        var isOlder = (existing.mtime < item.mtime);
                        if (isNewer && !options.overwriteNewer) {
                            return next({remove:true});
                        } else if (isSame && !options.overwriteSame) {
                            return next({remove:true});
                        } else if (isOlder && !options.overwriteOlder) {
                            return next({remove:true});
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

            }.bind(cloned), options);

        }.bind(this));

    }

    collate(on, to, options) {

        var options = util.parseArguments(arguments, ["on", "to", "options"], [["undefined|object"], ["undefined|string", "undefined|string", "object"]], "Stats.collate");
        options = util.defaults(options, {
            overwriteOlder: true,
            overwriteSame: false,
            overwriteNewer: false,
            force: false,
            files: true,
            dirs: true,
            sync: false,
            syncCopy: false,
            includeParentDirs: true,
            timestamp: Date.now(),
        });

        options.to = util.abs(options.to, this.location);
        util.mkdir(options.to);

        if (!options.on) {
            throw "Stats.collate: no 'on' argument defined";
        }
        if (options.on.substr(0,1) === "/") options.on = options.on.substr(1);

        return new Promise(function collatePromise(resolve, reject) {

            var cloned = this.clone();

            cloned.each(function collateNext(item, next) {

                if (!item) {
                    return resolve(this);
                }

                var relativeLocation = util.rel(item.location, this.location);
                var lastIndexOccurance = relativeLocation.lastIndexOf(options.on);
                if (lastIndexOccurance === -1) {
                    return next({remove:true});
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
                            return next({remove:true});
                        } else if (isSame && !options.overwriteSame) {
                            return next({remove:true});
                        } else if (isOlder && !options.overwriteOlder) {
                            return next({remove:true});
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

            }.bind(cloned));

        }.bind(this));

    }

    delete() {

        return new Promise(function deletePromise(resolve, reject) {

            var cloned = this.clone();

            cloned.reverseEach(function deletesNext(item, next) {

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

            }.bind(cloned));

        }.bind(this));

    }

}

module.exports = util.Stats = Stats;