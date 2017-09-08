'use strict';

var util = require("./util");
var path = require("path");
var fs = require("fs");
var MATCH = require("./MATCH");

class Stat {

    constructor(location) {

        if (arguments.length === 0) return;

        this.location = util.abs(location);

        this.update();

        var parsed = path.parse(this.location);
        for (var k in parsed) {
            this[k] = parsed[k];
        }

        if (this.isFile) {
            this.file = parsed.name;
            this.ext = parsed.ext;
        } else {
            this.file= null;
            this.ext = null;
        }

    }

    update(options) {

        if (options && !options.update && this.timestamp) {

            var update = false;

            if (options.timestamp && options.timestamp > this.timestamp) update = true;
            if (options.age && Date.now() - options.age > this.timestamp) update = true;

            if (!update) {
                return this;
            }

        }

        this.timestamp = Date.now();
        this.children = null;

        var stat;
        try {
            stat = fs.statSync(this.location);
        } catch (err) {
            stat = null;
        }

        if (!stat) {
            this.birthtime = null;
            this.ctime = null;
            this.mtime = null;
            this.size = null;
            this.isDir = null;
            this.isFile = null;
            this.exists = false;
            return this;
        }

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

        return this;

    }

    getChildren(options) {

        if (!this.isDir || !this.exists) {
            return this.children = null;
        }

        if (this.children && options && !options.update && this.timestamp) {

            var update = false;

            if (options.timestamp && options.timestamp > this.timestamp) update = true;
            if (options.age && Date.now() - options.age > this.timestamp) update = true;

            if (!update) {
                return this.children;
            }

        }

        this.children = [];

        try {
            var list = fs.readdirSync(this.location);
        } catch (e) {
            this.update({force:true});
            return this.children = null;
        }

        for (var i = 0, l = list.length; i < l; i++) {

            if (options.cancel) {
                return;
            }

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

        var stat = new Stat();
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

}

module.exports = util.Stat = Stat;