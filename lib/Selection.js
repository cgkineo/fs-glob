"use strict";

var util = require("./util");
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
        this.stat = new util.Stat(this.location);  

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
            if (pattern instanceof RegExp) {
                this.matchRe.push(pattern);
                continue;
            }

            if (pattern.substr(0,2) === "./") {
                pattern = pattern.substr(2);
            }

            if (pattern.substr(0,1) === "!") {
                this.negateRe.push(pattern.substr(1));
                continue;
            }
            
            var isNotRegExp = (pattern.substr(0,1) !== "/");
            if (isNotRegExp) {
                // process glob parts
                var parts = pattern.split("/");
                for (var p = 0, pl = parts.length -1 ; p < pl; p++) {
                    var partPath = parts.slice(0, p+1).join("/");
                    this.descendRe.push(partPath);
                }
            }
            this.matchRe.push(pattern);
            

        }

        var types = ['descendRe','matchRe','negateRe'];
        for (var t = 0, lt = types.length; t < lt; t++) {

            var type = types[t];
            this[type] = util.unique(this[type]);

            for (var i = 0, l = this[type].length; i < l; i++) {

                var item = this[type][i];
                if (item.substr(0,1) === "/") {
                    //process as regex
                    var endSlash = item.lastIndexOf("/");
                    if (endSlash <= 0) endSlash = item.length;

                    var body = item.slice(1, endSlash);
                    var flags = item.slice(endSlash+1);
                    this[type][i] = new RegExp(body, flags);

                } else {
                    //process as glob
                    this[type][i] = minimatch.makeRe(item, {
                        matchBase: true,
                        dot: true
                    });
                }

            }

        }

        return this;

    }

    match(location) {

        for (var i = 0, l = this.negateRe.length; i < l; i++) {

            if (!this.negateRe[i].test(location)) {
                continue;
            }

            return 0;

        }

        var matched = false;
        for (var i = 0, l = this.matchRe.length; i < l; i++) {
            
            if (!this.matchRe[i].test(location)) {
                continue;
            }
            
            matched = true;
            break;

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

            stats.copy(options).then(resolve, reject);

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

            stats.collate(options).then(resolve, reject);

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

            stats.delete().then(resolve, reject);

        }.bind(this));

    }

    watch(callback, options) {

        if (arguments.length < 1) {
            return undefined;
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

        return util.watches.register(this, options);;

    }

    play(callback) {

        if (!callback) {
            util.watches.pause(this);
            return this;
        }

        if (!this.watches) {
            return this;
        }

        for (var i = 0, l = this.watches.length; i < l; i++) {
            if (this.watches[i].callback === callback) {
                this.watches[i].play();
                return this;
            }
        }

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
                this.watches[i].pause();
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

module.exports = util.Selection = Selection;