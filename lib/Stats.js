'use strict';

var ASyncIterator = require("./ASyncIterator");
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

        var result = new Stats(this.selector, this.options);

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

        var clone = new Stats(this.selector, this.options);
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