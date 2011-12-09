// Copyright 2011 Google Inc. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview Minimal flags implementation needed for the shader compiler.
 *     This should only be used with Node.js code.
 * @author rowillia@google.com (Roy Williams)
 */

goog.provide('goog.node.FLAGS');
goog.provide('goog.node.commandLineFlag');



/**
 * Object for storing an instance of a command line flag.
 * @param {string} name The name of this flag.
 * @param {*} defaultValue The default value to return if the flag has not
 *     yet been set.
 * @param {string} description The description of this flag.
 * @constructor
 */
goog.node.commandLineFlag = function(name, defaultValue, description) {
  /**
   * The name of this flag.
   * @type {string}
   * @private
   */
  this.name_ = name;

  /**
   * The default value of this flag.
   * @type {*}
   * @private
   */
  this.defaultValue_ = defaultValue;

  /**
   * The description of this flag.
   * @type {string}
   * @private
   */
  this.description_ = description;

  /**
   * The value set from the command line of this flag.
   * @type {Object|undefined}
   */
  this.value = undefined;
};


/**
 * Returns the current value for a command line flag.
 * @return {*} The value of the flag.
 */
goog.node.commandLineFlag.prototype.getValue = function() {
  if (goog.isDef(this.value)) {
    return this.value;
  }
  return this.defaultValue_;
};


/**
 * Object for declaring and retrieving flag values.
 * @constructor
 */
goog.node.FLAGS = function() {
};


/**
 * Map of flag names to their flag values.
 * @type {!Object.<string, goog.node.commandLineFlag>}
 * @private
 */
goog.node.FLAGS.definedFlags_ = {};


/**
 * Defines a new string flag
 * @param {string} name The name of this flag.
 * @param {string} defaultValue The default value to return if the flag has not
 *     yet been set.
 * @param {string} description The description of this flag.
 */
goog.node.FLAGS.define_string = function(name, defaultValue, description) {
  var newFlag = new goog.node.commandLineFlag(name, defaultValue, description);
  goog.node.FLAGS.definedFlags_[name] = newFlag;
  goog.node.FLAGS.__defineGetter__(name, function() {
    return String(newFlag.getValue());
  });
};

/**
 * Defines a new bool flag
 * @param {string} name The name of this flag.
 * @param {string} defaultValue The default value to return if the flag has not
 *     yet been set.
 * @param {boolean} description The description of this flag.
 */
goog.node.FLAGS.define_bool = function(name, defaultValue, description) {
  var newFlag = new goog.node.commandLineFlag(name, defaultValue, description);
  goog.node.FLAGS.definedFlags_[name] = newFlag;
  goog.node.FLAGS.__defineGetter__(name, function() {
    return Boolean(newFlag.getValue());
  });
};


/**
 * Using the node runtime, parses out any command line arguments into their flag
 *     values.  Should be called after all flags are declared and before they
 *     are used.
 */
goog.node.FLAGS.parseArgs = function() {
  var lastParam = null;
  process.argv.forEach(function(value, index) {
    var splitParam = value.split('=', 2);
    var flag, flagValue;
    if (splitParam.length > 1) {
      flag = splitParam[0];
      flagValue = splitParam[1];
    } else {
      if (lastParam) {
        flag = lastParam;
        flagValue = value;
      } else {
        lastParam = value;
      }
    }
    if (flag && flagValue) {
      flag = flag.slice(2);
      if (flag in goog.node.FLAGS.definedFlags_) {
        goog.node.FLAGS.definedFlags_[flag].value = flagValue;
      }
    }
  });
};