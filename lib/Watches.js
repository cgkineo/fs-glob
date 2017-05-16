'use strict';

var ASyncIterator = require("./ASyncIterator");
var Watch = require("./Watch");
var util = require("./util");

class Watches extends ASyncIterator {

    constructor() {
        super();
    }

    register(selector, options) {

        for (var i = 0, l = this.length; i < l; i++) {
            if (this[i].selector === selector) {
                return this;
            }
        }

        var watch = new Watch(selector, options);
        this.push(watch);
        
        watch.change();

        return watch;

    }

    unregister(selectorOrWatch) {

        if (!selectorOrWatch) {
            for (var i = 0, l = this.length; i < l; i++) {
                this[i].detachWatcher();
            }
            this.length = 0;
            return this;
        }

        for (var i = 0, l = this.length; i < l; i++) {
            if (this[i] === selectorOrWatch || this[i].selector === selectorOrWatch) {
                this[i].detachWatcher();
                this.splice(i,1);
                return this;
            }
        }

        return this;

    }

    play(selectorOrWatch) {

        if (!selectorOrWatch) {
            for (var i = 0, l = this.length; i < l; i++) {
                this[i].play();
            }
            return this;
        }

        for (var i = 0, l = this.length; i < l; i++) {
            if (this[i] === selectorOrWatch || this[i].selector === selectorOrWatch) {
                this[i].play();
                return this;
            }
        }

        return this;

    }

    pause(selectorOrWatch) {

        if (!selectorOrWatch) {
            for (var i = 0, l = this.length; i < l; i++) {
                this[i].pause();
            }
            return this;
        }

        for (var i = 0, l = this.length; i < l; i++) {
            if (this[i] === selectorOrWatch || this[i].selector === selectorOrWatch) {
                this[i].pause();
                return this;
            }
        }

        return this;

    }

}

util.watches = new Watches();

module.exports = Watches;