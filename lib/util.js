"use strict";

global._CLM012 = global._CLM012 || { 
    stats : {}, 
    watches: []
};

var osenv = require("osenv");
var path = require("path");
var fs = require("fs");
var handlebars = require("handlebars");

class Util {

    static escapeRegExp(str) {
        return str.replace(/[.^$*+?()[{\\|\]-]/g, '\\$&');
    }

    static repeater(next) {
        if (!Util.repeater.skip) Util.repeater.skip = 0;
        if (Util.repeater.skip >= 100) {
            Util.repeater.skip = 0;
            setImmediate(next);
        } else {
            Util.repeater.skip++;
            next();
        }
    }

    static makeArray(value) {
        if (value instanceof Array) {
            return value;
        }
        return [value];
    }

    static copyArray(arr) {
        var arr1 = [];
        arr1.push.apply(arr1, arr);
        return arr1;
    }

    static unique(arr) {
        var unique = {};
        for (var i = 0, l = arr.length; i < l; i++) {
            unique[arr[i]] = true;
        }
        return Object.keys(unique);
    }

    static difference(arr1, arr2) {
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

    static groupby(arr, name) {
        var grouped = {};
        for (var i = 0, l = arr.length; i < l; i++) {
            grouped[arr[i][name]] = arr[i];
        }
        return grouped;
    }

    static leftright(hash1, hash2, compare) {

        var unique = {};
        for (var k in hash1) {
            // potentially unique to left
            unique[k] = -2;
        }
        for (var k in hash2) {
            if (unique[k]) {
                var comparison = compare(hash1[k], hash2[k]);
                unique[k] = comparison;
                continue;
            }
            // unique to right
            unique[k] = 2;
        }

        var leftright = {};
        var count = 0;
        for (var k in unique) {
            if (unique[k]) {
                count++;
                leftright[k] = unique[k];
            }
        }
        return (!count ? null : leftright);

    }

    static defaults(options, defaults) {

        options = options || {};

        for (var k in defaults) {
            if (options[k] === undefined) {
                options[k] = defaults[k];
            }
        }

        return options;

    }

    static parseArguments(args, names) {

        var isArray = (args[0] instanceof Array);
        var isObject = (args[0] instanceof Object);

        var options = {};

        var isFirstArgumentOptionsObject = (!isArray && isObject);
        if (isFirstArgumentOptionsObject) {
            return args[0];
        }

        for (var i = 0, l = names.length; i < l; i++) {
            
            var name = names[i];
            if (name === "options" && args[i]) {
                
                for (var k in options[k]) {
                    args[i][k] = options[k];
                }

                options = args[i];
                continue;
            }

            options[name] = args[i];
            
        }

        return options;

    }

    static extend() {

        if (!arguments[0]) return arguments[0];

        for (var i = 1, l = arguments.length; i < l; i++) {
            if (!arguments[i]) continue;
            for (var k in arguments[i]) {
                arguments[0][k] = arguments[i][k];
            }
        }

        return arguments[0];

    }

    static debounce(callback, timeout) {

        var handle = null;
        var debounced = function debounced() {
            clearTimeout(handle);
            handle = setTimeout(callback, timeout);
        };
        debounced.cancel = function cancelDebounce() {
            clearTimeout(handle);
        };
        return debounced;

    }

    static posix(location) {
        return location.replace(/\\/g, "/");
    }

    static mkdir(location, pwd) {

        location = Util.abs(location, pwd);

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

    static abs(location, pwd) {
        //translate relative paths to absolute paths

        //if no location defined, assume cwd
        pwd = Util.norm(pwd || "");
        switch (pwd) {
            case ".": case "./":
                pwd = Util.cwd(); 
        }

        location = Util.posix(location || "");
        if (location === "") {
            return pwd;
        }
        location = location + "";

        var firstCharacter = location.substr(0,1);
        var secondCharacter = location.substr(1,1);

        //take into consideration the ~ home variable
        if (firstCharacter === "~") {
            location = Util.join( Util.home(), location.substr(1));
        }

        var firstCharacter = location.substr(0,1);
        var secondCharacter = location.substr(1,1);
        
        //if path is absolute or contains windows drive separator
        if (firstCharacter === "/" || secondCharacter === ":") {
            return Util.norm(location);
        }
        
        //if path is not absolute
        return Util.join(pwd, location);

    }

    static rel(location, pwd) {
        location = Util.abs(location);
        pwd = Util.abs(pwd);
        var rel =  location.substr(pwd.length);
        if (rel[0] === "/") rel = rel.substr(1);
        return rel;
    }

    static home() {
        var home = osenv.home();
        return Util.posix(home);
    }

    static cwd() {
        var cwd = process.cwd();
        return Util.posix(cwd);
    }

    static norm(location) {
        return path.posix.normalize(Util.posix(location));
    }

    static join() {
        return path.posix.join.apply(path.posix.join, arguments);
    }

    static stat(location, options) {

        var stat = _CLM012.stats[location];

        if (!stat) {
            stat = _CLM012.stats[location] = new Util.Stat(location);
        } else {
            stat.update(options);
        }

        return stat;

    }

}

module.exports = Util;