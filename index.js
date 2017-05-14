"use strict";

global._CLM012 = global._CLM012 || { stats : {}, watches: [] };

var osenv = require("osenv");
var path = require("path");
var fs = require("fs");
var minimatch = require("minimatch");
var handlebars = require("handlebars");
const EventEmitter = require('events');

function repeater(next) {
    if (repeater.skip >= 100) {
        repeater.skip = 0;
        process.nextTick(next);
    } else {
        repeater.skip++;
        next();
    }
}
repeater.skip = 0;

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
        unique[arr1[i]] = 1;
    }
    for (var i = 0, l = arr2.length; i < l; i++) {
        unique[arr2[i]] = (unique[arr2[i]] === undefined) ? 2 : 0;
    }
    var difference = [];
    for (var k in unique) {
        if (unique[k]) {
            difference.push(k);
        }
    }
    return difference;
}

function groupby(arr, name) {
    var grouped = {};
    for (var i = 0, l = arr.length; i < l; i++) {
        grouped[arr[i][name]] = arr[i];
    }
    return grouped;
}

function leftright(hash1, hash2, compare) {

    var unique = {};
    for (var k in hash1) {
        // potentially unique to left
        unique[k] = -1;
    }
    for (var k in hash2) {
        if (unique[k]) {
            var comparison = compare(hash1[k], hash2[k]);
            if (comparison === 0) {
                unique[k] = 0; // same, ignore
            } else if (comparison < 0) {
                unique[k] = -2; // left is more
            } else {
                unique[k] = 2 // right is more
            }
            continue;
        }
        // unique to right
        unique[k] = 1;
    }

    var leftright = {};
    var count = 0;
    for (var k in unique) {
        if (unique[k]) {
            count++;
            leftright[k] = unique[k];
        }
    }
    return !count ? null : leftright;

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

function extend() {

    if (!arguments[0]) return arguments[0];

    for (var i = 1, l = arguments.length; i < l; i++) {
        if (!arguments[i]) continue;
        for (var k in arguments[i]) {
            arguments[0][k] = arguments[i][k];
        }
    }

    return arguments[0];

}

function debounce(callback, timeout) {

    var handle = null;
    return function debounced() {
        clearTimeout(handle);
        handle = setTimeout(callback, timeout);
    };

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

            var cont = true;

            var noop = function noop(passed) {
                if (passed === false) {
                    index--;
                    this.splice(index,1);
                    
                }
                cont = true;
            }.bind(this);
            
            while (cont && index < this.length && index > -1 && this.length > 0) {

                item = this[index];
                index++;
                cont = false;
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

            var cont = true;

            var noop = function noop(passed) {
                if (passed === false) {
                    index++;
                    this.splice(index,1);
                    
                }
                cont = true;
            }.bind(this);
            
            while (cont && index > -1 && index > -1 && this.length > 0) {

                item = this[index];
                index--;
                cont = false;
                callback(item, noop);

            }

            callback(null);


        } else {

            var next = function reverseEachNext() {

                if (index < 0 || this.length === 0 || index >= this.length) {
                    return callback(null);
                }

                item = this[index];
                index--;
                callback(item, cont);

            }.bind(this);

            var cont = function eachCont(passed) {

                if (passed === false) {
                    index++;
                    this.splice(index,1);
                }
                repeater(next);

            }.bind(this);
            
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

class Stat {

    constructor(location, dontUpdate) {

        if (dontUpdate) return;

        this.location = api.abs(location);

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

        if (options && !options.updateStat && this.timestamp && eval(options.updateStatOn) < this.timestamp) {
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

        if (options && !options.updateStat && this.children && eval(options.updateStatOn) < this.timestamp) {
            return this.children;
        }

        this.children = [];

        var list = fs.readdirSync(this.location);

        for (var i = 0, l = list.length; i < l; i++) {

            var subitem = list[i];
            var fullpath = api.join(this.location, subitem);

            var subitemStat = api.stat(fullpath, options);

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

            var stat = api.stat(selected.location, options);

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
                    var relativePath = api.rel(subitemStat.location, selected.location);

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

class Watches extends ASyncIterator {

    constructor() {
        super();

        this.handle = null;
        this.inWatch = false;
        this.onInterval = this.onInterval.bind(this);

    }

    register(selector) {

        for (var i = 0, l = this.length; i < l; i++) {
            if (this[i].selector === selector) {
                return this;
            }
        }

        var item = {
            parent: this,
            selector: selector,
            paused: false,
            changed: [],
            deleted: [],
            added: []
        };
        item.trigger = debounce(function trigger() {

            this.inWatch = true;
            clearInterval(this.parent.handle);
            this.parent.handle = null;

            this.selector.watches.each(function(watch, nextWatch) {

                if (!watch) {
                    this.changed.length = 0;
                    this.deleted.length = 0;
                    this.added.length = 0;
                    return;
                }

                watch.callback({
                    changed: this.changed,
                    delete: this.deleted,
                    added: this.added
                });

                nextWatch();

            }.bind(this));

            if (!this.parent.handle) {
                this.parent.handle = setInterval(this.parent.onInterval, 2000);
            }

        }.bind(item), 3000);

        this.push(item);

        if (!this.handle && !this.inWatch) {
            this.handle = setInterval(this.onInterval, 2000);
        }

    }

    unregister(selector) {

        if (!selector) {
            this.length = 0;
            clearInterval(this.handle);
            this.handle = null;
            return this;
        }

        for (var i = 0, l = this.length; i < l; i++) {
            if (this[i].selector === selector) {
                this.splice(i,1);
                if (this.length === 0) {
                    clearInterval(this.handle);
                    this.handle = null;
                }
                return this;
            }
        }

        return this;

    }

    pause(selector) {

        if (!selected) {
            for (var i = 0, l = this.length; i < l; i++) {
                this[i].paused = true;
            }
            return this;
        }

        for (var i = 0, l = this.length; i < l; i++) {
            if (this[i].selector === selector) {
                this[i].paused = true;
                return this;
            }
        }

        return this;

    }

    play(selector) {

        if (!selected) {
            for (var i = 0, l = this.length; i < l; i++) {
                this[i].paused = false;
            }
            return this;
        }

        for (var i = 0, l = this.length; i < l; i++) {
            if (this[i].selector === selector) {
                this[i].paused = false;
                return this;
            }
        }

        return this;

    }

    onInterval() {

        var options = {
            sync: true,
            updateStatOn: "Date.now() - 1500"
        };

        this.each(function(item, nextSelector) {

            if (!item) {
                return;
            }

            item.selector.stats(options)
            .then(function(stats) {

                if (!item.previous) {
                    item.previous = groupby(stats, "location");
                    return nextSelector();
                }

                var groupedStats = groupby(stats, "location");

                var lr = leftright(item.previous, groupedStats, function(a, b) {
                    var parsed = path.parse(a.location);
                    if (b.mtime === a.mtime) {
                        return 0;
                    }
                    var isBNewer = (b.mtime > a.mtime);
                    if (isBNewer) return 1;
                    return -1;
                });

                if (!lr) {
                    item.previous = groupedStats;
                    return nextSelector();
                }

                for (var k in lr) {
                    switch (lr[k]) {
                    case 2: case -2:
                        item.changed.push(groupedStats[k]);
                        break;
                    case -1:
                        item.deleted.push(item.previous[k]);
                        break;
                    case 1:
                        item.added.push(groupedStats[k]);
                        break;
                    }
                }

                item.previous = groupedStats;
                
                item.trigger();

                nextSelector();

            }.bind(this));

        }.bind(this), options);

    }

}

class Selection extends Array {

    constructor(globs, location, pwd) {

        super();

        var options = parseArguments(arguments, ["globs", "location", "pwd"]);
        this.globs = makeArray(options.globs);
        this.expand = options.expand || null;

        var pwd = api.abs(options.pwd);
        this.location = api.abs(options.location, pwd);
        this.stat = new Stat(this.location);  

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

    update() {

        var globs = this.globs;
        if (this.expand) {

            var expandedGlobs = [];
            globs.forEach(function(glob) {

                var template = handlebars.compile(glob);
                makeArray(this.expand).forEach(function(expand) {
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

        this.descendRe = unique(this.descendRe);
        this.matchRe = unique(this.matchRe);
        this.negateRe = unique(this.negateRe);

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

        var options = parseArguments(arguments, ["options"]);
        options = defaults(options, {
            files: true, 
            dirs: true,
            includeParentDirs: false,
            timestamp: Date.now()
        });

        return this.stat.walk(this, options);

    }

    copy(to, options) {
        
        var options = parseArguments(arguments, ["to", "options"]);
        options = defaults(options, {
            overwriteOlder: true,
            overwriteSame: false,
            overwriteNewer: false,
            force: false,
            files: true, 
            dirs: true,
            includeParentDirs: true,
            timestamp: Date.now()
        });

        options.to = api.abs(options.to, this.location);
        api.mkdir(options.to);

        return this.stat.walk(this, options, function copyWalked(resolve, reject, stats) {

            stats.each(function copyNext(item, next) {

                if (!item) {
                    resolve(stats);
                    return;
                }

                var relativeDir = api.rel(item.location, this.location);
                var toDestination = api.join( options.to, relativeDir );

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
                    api.mkdir(toDestination, this.location);
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
            force: false,
            files: true,
            dirs: true,
            includeParentDirs: true,
            timestamp: Date.now(),
        });

        options.to = api.abs(options.to, this.location);
        api.mkdir(options.to);

        if (!options.on) {
            throw "No on defined";
        }
        if (options.on.substr(0,1) === "/") options.on = options.on.substr(1);

        return this.stat.walk(this, options, function collateWalked(resolve, reject, stats) {

            stats.each(function collateNext(item, next) {

                if (!item) {
                    return resolve(stats);
                }

                var relativeLocation = api.rel(item.location, this.location);
                var lastIndexOccurance = relativeLocation.lastIndexOf(options.on);
                if (lastIndexOccurance === -1) {
                    return next(false);
                }

                var truncated = relativeLocation.substr(relativeLocation.lastIndexOf(options.on)+options.on.length);
                var toDestination = api.join( options.to, truncated );

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

                    api.mkdir(toDestination, this.location);
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
            watch.play(this);
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
            callback: callback
        });

        watch.register(this);

        return this;

    }

    pause(callback) {

        if (!callback) {
            watch.pause(this);
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
            watch.unregister(this);
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
            watch.unregister(this);
            this.watches = null;
            return this;
        }

        return this;
    }

}

var api = function SelectionCreator(globs, location, pwd) { 
    return new Selection(globs, location, pwd); 
};
extend(api, {

    posix: function posix(location) {
        return location.replace(/\\/g, "/");
    },

    mkdir: function mkdir(location, pwd) {

        location = api.abs(location, pwd);

        var parts = location.split("/");
        for (var i = 0, l = parts.length; i < l; i++) {
            var fullpath = parts.slice(0, i+1).join("/");
            if (fs.existsSync(fullpath)) {
                continue;
            }
            fs.mkdirSync(fullpath, 0o777);
        }

        return this;

    },

    abs: function abs(location, pwd) {
        //translate relative paths to absolute paths

        //if no location defined, assume cwd
        pwd = api.norm(pwd || "");
        switch (pwd) {
            case ".": case "./":
                pwd = api.cwd(); 
        }

        location = api.posix(location || "");
        if (location === "") {
            return pwd;
        }
        location = location + "";

        var firstCharacter = location.substr(0,1);
        var secondCharacter = location.substr(1,1);

        //take into consideration the ~ home variable
        if (firstCharacter === "~") {
            location = api.join( api.home(), location.substr(1));
        }

        var firstCharacter = location.substr(0,1);
        var secondCharacter = location.substr(1,1);
        
        //if path is absolute or contains windows drive separator
        if (firstCharacter === "/" || secondCharacter === ":") {
            return api.norm(location);
        }
        
        //if path is not absolute
        return api.join(pwd, location);

    },

    rel: function rel(location, pwd) {
        location = api.abs(location);
        pwd = api.abs(pwd);
        var rel =  location.substr(pwd.length);
        if (rel[0] === "/") rel = rel.substr(1);
        return rel;
    },

    home: function home() {
        var home = osenv.home();
        return api.posix(home);
    },

    cwd: function cwd() {
        var cwd = process.cwd();
        return api.posix(cwd);
    },

    norm: function norm(location) {
        return path.posix.normalize(api.posix(location));
    },

    join: function join() {
        return path.posix.join.apply(path.posix.join, arguments);
    },

    stat: function stat(location, options) {

        var stat = _CLM012.stats[location];

        if (!stat) {
            stat = _CLM012.stats[location] = new Stat(location);
        } else {
            stat.update(options);
        }

        return stat;

    },

    stats: function stats(options) {
        return (new Selection(options)).stats(options);
    },

    collate: function collate(options) {
        return (new Selection(options)).collate(options);
    },

    copy: function copy(options) {
        return (new Selection(options)).copy(options);
    },

    delete: function deleteFiles(options) {
        return (new Selection(options)).delete(options);
    },

    watch: function watch(options, callback) {
        if (!arguments.length) {
            watch.play();
            return api;
        }

        return (new Selection(options)).watch(callback, options);
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

var watch = new Watches();
module.exports = api;