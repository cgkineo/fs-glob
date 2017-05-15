'use strict';

var ASyncIterator = require("./ASyncIterator");

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

module.exports = Stats;