"use strict";

var util = require("./util");
var Stat = require("./Stat");
var ASyncIterator = require("./ASyncIterator");
var minimatch = require("minimatch");

class Selection extends Array {

    constructor(globs, location, pwd) {

        super();

        var options = util.parseArguments(arguments, ["globs", "location", "pwd"]);
        this.globs = util.makeArray(options.globs);
        this.expand = options.expand || null;

        var pwd = util.abs(options.pwd);
        this.location = util.abs(options.location, pwd);
        this.stat = new Stat(this.location);  

        this.update();

    }

    add(globs) {

        var merge = util.copyArray(this).concat(util.makeArray(globs));
        this.length = 0;
        this.push.apply(this, util.unique(merge));
        this.update();

        return this;

    }

    remove(globs) {

        var merge = util.difference(util.copyArray(this), util.makeArray(globs));
        this.length = 0;
        this.push.apply(this, merge);
        this.update();

        return this;

    }

    update() {

        var globs = this.globs;
        if (this.expand) {

            var expandedGlobs = [];
            globs.forEach(function(glob) {

                var template = handlebars.compile(glob);
                util.makeArray(this.expand).forEach(function(expand) {
                    expandedGlobs.push(template(expand));
                });

            }.bind(this));

            globs = expandedGlobs;

        }
        this.length = 0;
        this.push.apply(this, globs);
        
        this.descendRe = [];
        this.matchRe = [];
        this.negateRe = [];

        for (var i = 0, l = this.length; i < l; i++) {
            
            var pattern = this[i];
            if (pattern.substr(0,2) === "./") {
                pattern = pattern.substr(2);
            }

            if (pattern.substr(0,1) === "!") {
                this.negateRe.push(item);
                continue;
            }

            var parts = pattern.split("/");
            for (var p = 0, pl = parts.length -1 ; p < pl; p++) {
                var partPath = parts.slice(0, p+1).join("/");
                this.descendRe.push(partPath);
            }
            this.matchRe.push(parts.join("/"));

        }

        this.descendRe = util.unique(this.descendRe);
        this.matchRe = util.unique(this.matchRe);
        this.negateRe = util.unique(this.negateRe);

        for (var i = 0, l = this.descendRe.length; i < l; i++) {
            this.descendRe[i] = minimatch.makeRe( this.descendRe[i], {
                matchBase:true,
                dot: true
            });
        }

        for (var i = 0, l = this.matchRe.length; i < l; i++) {
            this.matchRe[i] = minimatch.makeRe( this.matchRe[i], {
                matchBase:true,
                dot: true
            });
        }

        for (var i = 0, l = this.negateRe.length; i < l; i++) {
            this.negateRe[i] = minimatch.makeRe( this.negateRe[i], {
                matchBase:true,
                dot: true
            });
        }

        return this;

    }

    match(location) {

        var matched = false;
        for (var i = 0, l = this.matchRe.length; i < l; i++) {
            
            if (!this.matchRe[i].test(location)) {
                continue;
            }
            
            matched = true;
            break;

        }

        for (var i = 0, l = this.negateRe.length; i < l; i++) {

            if (this.negateRe[i].test(location)) {
                continue;
            }
            
            return 0;

        }

        if (matched) {
            return 2;
        }
        
        for (var i = 0, l = this.descendRe.length; i < l; i++) {

            if (!this.descendRe[i].test(location)) {
                continue;
            }

            return 1;

        }

        return 0;       

    }

    stats(options) {

        var options = util.parseArguments(arguments, ["options"]);
        options = util.defaults(options, {
            files: true, 
            dirs: true,
            includeParentDirs: false,
            timestamp: Date.now()
        });

        return this.stat.walk(this, options);

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

        return this.stat.walk(this, options, function copyWalked(resolve, reject, stats) {

            stats.each(function copyNext(item, next) {

                if (!item) {
                    resolve(stats);
                    return;
                }

                var relativeDir = util.rel(item.location, this.location);
                var toDestination = util.join( options.to, relativeDir );

                if (!options.force) {
                    var existing = new Stat(toDestination);
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

        return this.stat.walk(this, options, function collateWalked(resolve, reject, stats) {

            stats.each(function collateNext(item, next) {

                if (!item) {
                    return resolve(stats);
                }

                var relativeLocation = util.rel(item.location, this.location);
                var lastIndexOccurance = relativeLocation.lastIndexOf(options.on);
                if (lastIndexOccurance === -1) {
                    return next(false);
                }

                var truncated = relativeLocation.substr(relativeLocation.lastIndexOf(options.on)+options.on.length);
                var toDestination = util.join( options.to, truncated );

                if (!options.force) {
                    var existing = new Stat(toDestination);
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

        }.bind(this))

    }

    delete(options) {

        var options = util.parseArguments(arguments, ["options"]);
        options = util.defaults(options, {
            files: true,
            dirs: true,
            includeParentDirs: false,
            timestamp: Date.now()
        });

        return this.stat.walk(this, options, function deleteWalked(resolve, reject, stats) {

            stats.reverseEach(function deletesNext(item, next) {

                if (!item) {
                    resolve(stats);
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

            });

        }.bind(this));

    }

    watch(callback, options) {

        if (!arguments.length) {
            util.watches.play(this);
            return this;
        }
        
        this.watches = this.watches || new ASyncIterator();

        for (var i = 0, l = this.watches.length; i < l; i++) {
            if (this.watches[i].callback === callback) {
                this.watches[i].paused = false;
                return this;
            }
        }

        this.watches.push({
            paused: false,
            callback: callback,
            options: options
        });

        util.watches.register(this, options);

        return this;

    }

    pause(callback) {

        if (!callback) {
            util.watches.pause(this);
            return this;
        }

        if (!this.watches) {
            return this;
        }

        for (var i = 0, l = this.watches.length; i < l; i++) {
            if (this.watches[i].callback === callback) {
                this.watches[i].paused = true;
                return this;
            }
        }

        return this;

    }

    stop(callback) {

        if (!this.watches) return this;

        if (!this.callback) {
            util.watches.unregister(this);
            this.watches = null;
            return this;
        }

        for (var i = 0, l = this.watches.length; i < l; i++) {
            if (this.watches[i].callback === callback) {
                this.watches.splice(i,1);
                break;
            }
        }

        if (!this.watches.length) {
            util.watches.unregister(this);
            this.watches = null;
            return this;
        }

        return this;
    }

}

module.exports = Selection;