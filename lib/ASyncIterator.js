'use strict';

var util = require("./util.js");

class ASyncIterator extends Array {

    constructor(first) {
        super(0);
        if (!first) return;
        this.push(first);
    }

    each(callback, options) {

        return new Promise(function eachPromise(resolve, reject) {

            options = util.defaults(options, {});

            var item;
            var index = 0;

            var next = function eachNext() {

                if (index >= this.length || this.length === 0 || index < 0) {
                    callback(null, function(){}, resolve, reject);
                    resolve(this);
                    return;
                }

                item = this[index];
                index++;
                callback(item, cont, resolve, reject);
                
            }.bind(this);

            var cont = function eachCont(opt) {

                if (opt && opt.remove) {
                    index--;
                    this.splice(index,1);
                }
                util.repeater(next);

            }.bind(this);
            
            cont();

        }.bind(this));

    }

    reverseEach(callback, options) {

        return new Promise(function eachPromise(resolve, reject) {

            options = util.defaults(options, {});
            
            var item;
            var index = this.length-1;

            var next = function reverseEachNext() {

                if (index < 0 || this.length === 0 || index >= this.length) {
                    callback(null, function(){}, resolve, reject);
                    resolve(this);
                    return;
                }

                item = this[index];
                index--;
                callback(item, cont, resolve, reject);

            }.bind(this);

            var cont = function eachCont(opt) {

                if (opt && opt.remove) {
                    index++;
                    this.splice(index,1);
                }
                util.repeater(next);

            }.bind(this);
            
            cont();

        }.bind(this));

    }

}

module.exports = ASyncIterator;