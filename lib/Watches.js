'use strict';

var ASyncIterator = require("./ASyncIterator");
var util = require("./util");

class Watches extends ASyncIterator {

    constructor() {
        super();
    }

    register(globs, options) {

        for (var i = 0, l = this.length; i < l; i++) {
            if (this[i].globs === globs) {
                return this[i];
            }
        }

        var watch = new util.Watch(globs, options);
        this.push(watch);
        
        watch.change();

        return watch;

    }

    play(globsOrWatch) {

        if (!globsOrWatch) {
            for (var i = 0, l = this.length; i < l; i++) {
                this[i].play();
            }
            return this;
        }

        for (var i = 0, l = this.length; i < l; i++) {
            if (this[i] === globsOrWatch || this[i].globs === globsOrWatch) {
                this[i].play();
                return this;
            }
        }

        return this;

    }

    pause(globsOrWatch) {

        if (!globsOrWatch) {
            for (var i = 0, l = this.length; i < l; i++) {
                this[i].pause();
            }
            return this;
        }

        for (var i = 0, l = this.length; i < l; i++) {
            if (this[i] === globsOrWatch || this[i].globs === globsOrWatch) {
                this[i].pause();
                return this;
            }
        }

        return this;

    }

    clear(globsOrWatch) {

        if (!globsOrWatch) {
            for (var i = 0, l = this.length; i < l; i++) {
                this[i].clear();
            }
            return this;
        }

        for (var i = 0, l = this.length; i < l; i++) {
            if (this[i] === globsOrWatch || this[i].globs === globsOrWatch) {
                this[i].clear();
                return this;
            }
        }

        return this;

    }

    unregister(globsOrWatch) {

        if (!globsOrWatch) {
            for (var i = 0, l = this.length; i < l; i++) {
                this[i].detachWatcher();
            }
            this.length = 0;
            return this;
        }

        for (var i = 0, l = this.length; i < l; i++) {
            if (this[i] === globsOrWatch || this[i].globs === globsOrWatch) {
                this[i].detachWatcher();
                this.splice(i,1);
                return this;
            }
        }

        return this;

    }
    
}

util.watches = new Watches();

module.exports = Watches;