'use strict';

var ASyncIterator = require("./ASyncIterator");
var Watch = require("./Watch");
var util = require("./util");

class Watches extends ASyncIterator {

    constructor() {
        super();

        this.handle = null;

    }

    register(selector, options) {

        for (var i = 0, l = this.length; i < l; i++) {
            if (this[i].selector === selector) {
                return this;
            }
        }

        var inWatch = false;
        for (var i = 0, l = this.length; i < l; i++) {
            inWatch = this.isInWatch() || inWatch;
        }

        var watch = new Watch(this, selector, options);
        this.push(watch);
        
        if (!inWatch) {
            watch.onChange();
        }

    }

    unregister(selector) {

        if (!selector) {
            for (var i = 0, l = this.length; i < l; i++) {
                this[i].detachWatcher();
            }
            this.length = 0;
            clearInterval(this.handle);
            this.handle = null;
            return this;
        }

        for (var i = 0, l = this.length; i < l; i++) {
            if (this[i].selector === selector) {
                this[i].detachWatcher();
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

}

util.watches = new Watches();

module.exports = Watches;