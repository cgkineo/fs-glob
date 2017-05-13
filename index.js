"use strict";

var osenv = require("osenv");
var path = require("path");
var fs = require("fs");
var minimatch = require("minimatch");

var repeaterSkip = 0;
var repeater = function repeater(next) {
    if (repeaterSkip >= 100) {
        repeaterSkip = 0;
        process.nextTick(next);
    } else {
        repeaterSkip++;
        next();
    }
}

function normalize(location) {
    return path.posix.normalize(posix(location));
}

function join() {
    return path.posix.join.apply(path.posix.join, arguments);
}

function cwd() {
    var cwd = process.cwd();
    return posix(cwd);
}

function home() {
    var home = osenv.home();
    return posix(home);
}

function mkdir(location, pwd) {

    location = absolute(location, pwd);

    var parts = location.split("/");
    for (var i = 0, l = parts.length; i < l; i++) {
        var fullpath = parts.slice(0, i+1).join("/");
        if (fs.existsSync(fullpath)) {
            continue;
        }
        fs.mkdirSync(fullpath, 0o777);
    }

    return this;

}

//translate relative paths to absolute paths
function absolute(location, pwd) {

    //if no location defined, assume cwd
    pwd = normalize(pwd || "");
    switch (pwd) {
        case ".": case "./":
            pwd = cwd(); 
    }

    location = posix(location || "");
    if (location === "") {
        return pwd;
    }
    location = location + "";

    var firstCharacter = location.substr(0,1);
    var secondCharacter = location.substr(1,1);

    //take into consideration the ~ home variable
    if (firstCharacter === "~") {
        location = join( home(), location.substr(1));
    }

    var firstCharacter = location.substr(0,1);
    var secondCharacter = location.substr(1,1);
    
    //if path is absolute or contains windows drive separator
    if (firstCharacter === "/" || secondCharacter === ":") {
        return normalize(location);
    }
    
    //if path is not absolute
    return join(pwd, location);

}

function relative(location, pwd) {
    location = absolute(location);
    pwd = absolute(pwd);
    var relative =  location.substr(pwd.length);
    if (relative[0] === "/") relative = relative.substr(1);
    return relative;
}

function posix(location) {
    return location.replace(/\\/g, "/");
}

function makeArray(value) {
    if (value instanceof  Array) {
        return value;
    }
    return [value];
}

function copyArray(arr) {
    var arr1 = [];
    arr1.push.apply(arr1, arr);
    return arr1;
}

function unique(arr) {
    var unique = {};
    for (var i = 0, l = arr.length; i < l; i++) {
        unique[arr[i]] = true;
    }
    return Object.keys(unique);
}

function difference(arr1, arr2) {
    var unique = {};
    for (var i = 0, l = arr1.length; i < l; i++) {
        unique[arr1[i]] = true;
    }
    for (var i = 0, l = arr2.length; i < l; i++) {
        unique[arr2[i]] = (unique[arr2[i]] === undefined) ? true : false;
    }
    var difference = [];
    for (var k in unique) {
        if (unique[k]) {
            difference.push(k);
        }
    }
    return difference;
}

function defaults(options, defaults) {

    options = options || {};

    for (var k in defaults) {
        if (options[k] === undefined) {
            options[k] = defaults[k];
        }
    }

    return options;

}

function parseArguments(args, names) {

    var isArray = (args[0] instanceof Array);
    var isObject = (args[0] instanceof Object);

    var options = {};

    var isFirstArgumentOptionsObject = (!isArray && isObject);
    if (isFirstArgumentOptionsObject) {
        for (var k in args[0]) {
            options[k] = args[0][k];
        }
        return options;
    }

    for (var i = 0, l = names.length; i < l; i++) {
        
        var name = names[i];
        if (name === "options" && args[i]) {
            
            for (var k in args[i]) {
                options[k] = args[i][k];
            }

            continue;
        }

        options[name] = args[i];
        
    }

    return options;

}

class ASyncIterator extends Array {

    constructor() {
        super(0);
    }

    each(callback, options) {

        options = defaults(options, {
            sync: false
        });

        var item;
        var index = 0;

        if (options.sync) {

            var noop = function noop(passed) {
                if (passed === false) {
                    index--;
                    this.splice(index,1);
                    
                }
            }.bind(this);
            
            while (index < this.length && index > -1 && this.length > 0) {

                item = this[index];
                index++;
                callback(item, noop);

            }

            callback(null);

        } else {

            var next = function eachNext() {

                if (index >= this.length || this.length === 0 || index < 0) {
                    return callback(null);
                }

                item = this[index];
                index++;
                callback(item, cont);
                
            }.bind(this);

            var cont = function eachCont(passed) {
                if (passed === false) {
                    index--;
                    this.splice(index,1);
                }
                repeater(next);
            }.bind(this);
            
            cont();

        }

        return this;

    }

    reverseEach(callback, options) {

        options = defaults(options, {
            sync: false
        });
        
        var item;
        var index = this.length-1;

        if (options.sync) {

            function noop() {}
            
            while (index > -1) {

                callback(this[index], noop);
                index--;
            }

            callback(null);

        } else {

            var next = function reverseEachNext() {

                if (index < 0) {
                    return callback(null);
                }

                item = this[index];
                index--;
                callback(item, cont);

            }.bind(this);

            function cont() {
                repeater(next);
            }
            
            cont();

        }

        return this;

    }

}

class Stack extends ASyncIterator {

    constructor(first) {
        super();
        this.push(first);
    }

}

global._CLM012 = global._CLM012 || {};

function getCreateStat(fullPath, options) {

    var location = _CLM012[fullPath];

    if (!location) {
        location = _CLM012[fullPath] = new Stat(fullPath);
    } else {
        location.update(options);
    }

    return location;

}

class Stat {

    constructor(location, dontUpdate) {

        if (dontUpdate) return;

        this.location = absolute(location);

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

        if (options && !options.updateStat && this.timestamp) {
            return;
        }

        this.timestamp = Date.now();

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

            this.birthtime = stat.birthtime;
            this.ctime = stat.ctime;
            this.mtime = stat.mtime;
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

        if (options && !options.updateStat && this.children) {
            return this.children;
        }

        this.children = [];

        var list = fs.readdirSync(this.location);

        for (var i = 0, l = list.length; i < l; i++) {

            var subitem = list[i];
            var fullpath = join(this.location, subitem);

            var subitemStat = getCreateStat(fullpath, options);

            this.children.push(subitemStat);

        }

        return this.children;

    }

    clone(cloneHash) {

        cloneHash = cloneHash || {};

        if (cloneHash[this.location]) {
            return cloneHash[this.location];
        }

        var location = new Stat("", true);
        for (var k in this) {

            if (k === "children") {
                continue;
            }
            
            location[k] = this[k];

        }

        if (this.children) {
            var childrenClone = location.children = new Array(this.children.length);
            for (var i = 0, l = this.children.length; i < l; i++) {
                if (cloneHash[this.children[i].location]) {
                    childrenClone[i] = cloneHash[this.children[i].location];
                } else {
                    childrenClone[i] = cloneHash[this.children[i].location] = this.children[i].clone();
                }
            }
        }

        return location;

    }

    walk(selected, options, callback) {

        return new Promise(function walkPromise(resolve, reject) {

            var location = getCreateStat(selected.at, options);

            var stack = new Stack(location);
            var walked = new Stats();
            var parentDirs = {};

            stack.each(function stackNext(item, next) {

                if (!item) {

                    if (!callback) {
                        resolve(walked);
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
                    var relativePath = relative(subitemStat.location, selected.at);

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

class Stats extends ASyncIterator {

    constructor(selector) {
        super();
        this.selector = selector;
    }

    pluck(name) {

        var plucked = new Array(this.length);
        for (var i = 0, l = this.length; i < l; i++) {
            plucked[i] = this[i][name];
        }

        return plucked;

    }

    clone() {

        var cloneHash = {};

        var clone = new Stats(this.selector);
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

}

class Selection extends Array {

    constructor(globs, at, pwd) {

        super();

        var optionsArg = arguments[0];
        var isArray = (optionsArg instanceof Array);
        var isObject = (optionsArg instanceof Object);

        if (!isArray && isObject) {
            at = optionsArg.at;
            pwd = optionsArg.pwd;
            globs = optionsArg.globs;
        }

        this.push.apply(this, makeArray(globs));    
        this.at = absolute(at, pwd);

        this.location = new Stat(this.at);  

        this.update();

    }

    add(globs) {

        var merge = copyArray(this).concat(makeArray(globs));
        this.length = 0;
        this.push.apply(this, unique(merge));
        this.update();

        return this;

    }

    remove(globs) {

        var merge = difference(copyArray(this), makeArray(globs));
        this.length = 0;
        this.push.apply(this, merge);
        this.update();

        return this;

    }

    match(at) {

        var matched = false;
        for (var i = 0, l = this.matchOn.length; i < l; i++) {
            
            if (!this.matchOn[i].test(at)) {
                continue;
            }
            
            matched = true;
            break;

        }

        for (var i = 0, l = this.negateOn.length; i < l; i++) {

            if (this.negateOn[i].test(at)) {
                continue;
            }
            
            return 0;

        }

        if (matched) {
            return 2;
        }
        
        for (var i = 0, l = this.descendInto.length; i < l; i++) {

            if (!this.descendInto[i].test(at)) {
                continue;
            }

            return 1;

        }

        return 0;       

    }

    update() {
        
        this.descendInto = [];
        this.matchOn = [];
        this.negateOn = [];

        for (var i = 0, l = this.length; i < l; i++) {
            
            var pattern = this[i];
            if (pattern.substr(0,2) === "./") {
                pattern = pattern.substr(2);
            }

            if (pattern.substr(0,1) === "!") {
                this.negateOn.push(item);
                continue;
            }

            var parts = pattern.split("/");
            for (var p = 0, pl = parts.length -1 ; p < pl; p++) {
                var partPath = parts.slice(0, p+1).join("/");
                this.descendInto.push(partPath);
            }
            this.matchOn.push(parts.join("/"));

        }

        this.descendInto = unique(this.descendInto);
        this.matchOn = unique(this.matchOn);
        this.negateOn = unique(this.negateOn);

        for (var i = 0, l = this.descendInto.length; i < l; i++) {
            this.descendInto[i] = minimatch.makeRe( this.descendInto[i], {
                matchBase:true,
                dot: true
            });
        }

        for (var i = 0, l = this.matchOn.length; i < l; i++) {
            this.matchOn[i] = minimatch.makeRe( this.matchOn[i], {
                matchBase:true,
                dot: true
            });
        }

        for (var i = 0, l = this.negateOn.length; i < l; i++) {
            this.negateOn[i] = minimatch.makeRe( this.negateOn[i], {
                matchBase:true,
                dot: true
            });
        }

        return this;

    }

    stats(options) {

        var options = parseArguments(arguments, ["options"]);
        options = defaults(options, {
            files: true, 
            dirs: true,
            includeParentDirs: false,
            timestamp: Date.now()
        });

        return this.location.walk(this, options);

    }

    copy(to, options) {
        
        var options = parseArguments(arguments, ["to", "options"]);
        options = defaults(options, {
            overwriteOlder: true,
            overwriteSame: false,
            overwriteNewer: false,
            forceOverwrite: false,
            files: true, 
            dirs: true,
            includeParentDirs: true,
            timestamp: Date.now()
        });
        options.to = absolute(options.to, this.at);

        return this.location.walk(this, options, function copyWalked(resolve, reject, locations) {

            locations.each(function copyNext(item, next) {

                if (!item) {
                    resolve(locations);
                    return;
                }

                var relativeDir = relative(item.location, this.at);
                var toDestination = join( options.to, relativeDir );

                if (!options.forceOverwrite) {
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
                    mkdir(toDestination, this.at);
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

        var options = parseArguments(arguments, ["on", "to", "options"]);
        options = defaults(options, {
            overwriteOlder: true,
            overwriteSame: false,
            overwriteNewer: false,
            forceOverwrite: false,
            file: true,
            dirs: true,
            includeParentDirs: true,
            timestamp: Date.now()
        });
        options.to = absolute(options.to, this.at);

        if (!options.on) {
            throw "No on defined";
        }

        return this.location.walk(this, options, function collateWalked(resolve, reject, locations) {

            locations.each(function collateNext(item, next) {

                if (!item) {
                    return resolve(locations);
                }

                var relativeStat = relative(item.location, this.at);
                var lastIndexOccurance = relativeStat.lastIndexOf(options.on);
                if (lastIndexOccurance === -1) {
                    return next(false);
                }

                var truncated = relativeStat.substr(relativeStat.lastIndexOf(options.on)+options.on.length);
                var toDestination = join( options.to, truncated );

                if (!options.forceOverwrite) {
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

                    mkdir(toDestination, this.at);
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

        var options = parseArguments(arguments, ["options"]);
        options = defaults(options, {
            file: true,
            dirs: true,
            includeParentDirs: false,
            timestamp: Date.now()
        });

        return this.location.walk(this, options, function deleteWalked(resolve, reject, locations) {

            locations.reverseEach(function deletesNext(item, next) {

                if (!item) {
                    resolve(locations);
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

    watchStats(callback) {
        
        this.watches = this.watches || [];

        for (var i = 0, l = this.watches.length; i < l; i++) {
            if (this.watches === callback) return this;
        }

        this.watches.push(callback);

        return this;

    }

    stopWatchStats(callback) {



        return this;
    }

}

var api = function Selection(globs, at, pwd) { 
    return new Selection(globs, at, pwd); 
};

api.mkdir = mkdir;
api.abs = absolute;
api.rel = relative;
api.home = home;
api.cwd = cwd;
api.norm = api.normalize = normalize;
api.join = join;
api.stat = getCreateStat;

api.stats = function(options) {
    var selector = new Selection(options);
    return selector.stats(options);
};
api.collate = function(options) {
    var selector = new Selection(options);
    return selector.collate(options);
};
api.copy = function(options) {
    var selector = new Selection(options);
    return selector.copy(options);
};
api.delete = function(options) {
    var selector = new Selection(options);
    return selector.delete(options);
};

module.exports = api;

//todo, watches, testing, errors