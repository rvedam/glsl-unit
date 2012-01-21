// Copyright 2011 Google Inc. All Rights Reserved.

/**
 * @fileoverview Preprocesses .glsl and .glslib files for use in the compiler.
 *     Takes in the contents of a glsl file and all known library files.
 * @author rowillia@google.com (Roy Williams)
 * @suppress {missingProperties}
 */

goog.provide('glslunit.compiler.TemplateCompiler');

goog.require('Mustache');
goog.require('glslunit.compiler.BraceReducer');
goog.require('glslunit.compiler.Compiler');
goog.require('glslunit.compiler.ConstructorMinifier');
goog.require('glslunit.compiler.DeadFunctionRemover');
goog.require('glslunit.compiler.DeclarationConsolidation');
goog.require('glslunit.compiler.FunctionMinifier');
goog.require('glslunit.compiler.Preprocessor');
goog.require('glslunit.compiler.VariableMinifier');
goog.require('goog.node.FLAGS');
goog.require('goog.object');

var path = require('path');
var fs = require('fs');

goog.node.FLAGS.define_string('input', undefined, 'The input file in GLSL.');
goog.node.FLAGS.define_string('output', '', 'The output js file.');
goog.node.FLAGS.define_string('source_output', '',
                              'The output shader source code file.');
goog.node.FLAGS.define_string('uniform_and_mode_output', '',
                             'The output uniform and mode information file.');
goog.node.FLAGS.define_string('template', '',
                              'The output shader source code file.');
goog.node.FLAGS.define_string('glsl_include_prefix', '',
    'Compiler will try prefixing this flag to the path of glsllib files. If ' +
    'not found there use ones in current directory.');

goog.node.FLAGS.define_bool('remove_dead_functions', true,
    'Compiler will remove any functions it determines to be dead.');
goog.node.FLAGS.define_string('variable_renaming', 'ALL',
    'The level at which the compiler will minify variable names.  ALL will ' +
    'minify all variable names, including uniforms and attributes but can ' +
    'also output a map of old names to new names.  INTERNAL will only minify' +
    'variables that aren\'t exposed to JavaScript.  OFF won\'t minify any ' +
    'variables.');
goog.node.FLAGS.define_string('consolidate_declarations', 'ALL',
    'The level at which the compiler will consolidate declarations.  ALL ' +
    'will consolidate all declarations, including attributes (this can ' +
    'change the values returned by getAttribLocation).  INTERNAL will ' +
    'consolidate all variables with the exception of attributes.  OFF won\'t' +
    'consolidate any attributes.');
goog.node.FLAGS.define_bool('function_renaming', true,
    'Compiler will minify all function names.');
goog.node.FLAGS.define_bool('remove_braces', true,
    'Remove all braces that aren\'t required.');
goog.node.FLAGS.define_bool('minify_constructors', true,
    'Compiler will minify all constructor calls where it can by removing ' +
    'inputs and converting types to int where possible.  For example, ' +
    'vec4(1.0, 1.0, 1.0, 1.0) will become vec4(1).');

goog.node.FLAGS.define_bool('pretty_print', false,
    'Output pretty-printed GLSL source code.');

goog.node.FLAGS.parseArgs();


/**
 * Set of valid GLSL extensions.
 * @type {Object.<string, boolean>}
 * @const
 */
var GLSL_EXTENSIONS = {
  '.glsl': true,
  '.glsllib': true
};


function main() {
  var inputDirectories = [path.dirname(goog.node.FLAGS['input'])];
  var inputFiles = {};
  if (goog.node.FLAGS.glsl_include_prefix) {
    inputDirectories.push(path.join(path.dirname(goog.node.FLAGS.input),
                                    goog.node.FLAGS.glsl_include_prefix));
  }
  inputDirectories.forEach(function(inputDir) {
    var glslFiles = fs.readdirSync(inputDir).filter(function(x) {
        return path.extname(x) in GLSL_EXTENSIONS;
    });
    glslFiles.forEach(function(fileName) {
      inputFiles[fileName] = fs.readFileSync(path.join(inputDir, fileName),
                                             'utf8');
    });
  });
  var start = new Date().getTime();
  try {
    var shaderProgram = glslunit.compiler.Preprocessor.ParseFile(
      path.basename(goog.node.FLAGS.input),
      inputFiles);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
  var originalProgram = /** @type {glslunit.compiler.ShaderProgram} */
      (goog.object.clone(shaderProgram));
  var finish = new Date().getTime();

  start = new Date().getTime();
  var compiler = new glslunit.compiler.Compiler(shaderProgram);

  var all_internal_map = {
    'ALL': true,
    'INTERNAL': false
  };

  if (goog.node.FLAGS.remove_dead_functions) {
    compiler.registerStep(glslunit.compiler.Compiler.CompilerPhase.MINIFICATION,
        new glslunit.compiler.DeadFunctionRemover());
  }
  if (goog.node.FLAGS.remove_braces) {
    compiler.registerStep(glslunit.compiler.Compiler.CompilerPhase.MINIFICATION,
        new glslunit.compiler.BraceReducer());
  }
  if (goog.node.FLAGS.variable_renaming in all_internal_map) {
    compiler.registerStep(glslunit.compiler.Compiler.CompilerPhase.MINIFICATION,
        new glslunit.compiler.VariableMinifier(
            all_internal_map[goog.node.FLAGS.variable_renaming]));
  }
  if (goog.node.FLAGS.consolidate_declarations in all_internal_map) {
    compiler.registerStep(glslunit.compiler.Compiler.CompilerPhase.MINIFICATION,
        new glslunit.compiler.DeclarationConsolidation(
            all_internal_map[goog.node.FLAGS.consolidate_declarations]));
  }
  if (goog.node.FLAGS.function_renaming) {
    compiler.registerStep(glslunit.compiler.Compiler.CompilerPhase.MINIFICATION,
        new glslunit.compiler.FunctionMinifier());
  }
  if (goog.node.FLAGS.minify_constructors) {
    compiler.registerStep(glslunit.compiler.Compiler.CompilerPhase.MINIFICATION,
        new glslunit.compiler.ConstructorMinifier());
  }

  shaderProgram = compiler.compileProgram();
  shaderProgram.prettyPrint = goog.node.FLAGS.pretty_print;

  finish = new Date().getTime();

  var output = '';
  if (goog.node.FLAGS.template) {
    var template = false;
    var template_source = fs.readFileSync(goog.node.FLAGS.template, 'utf8');
    shaderProgram.defaultUniformsAndAttributes();
    output = Mustache.to_html(template_source, shaderProgram) + '\n';
  } else {
    output =
       '\n//! VERTEX\n' +
        glslunit.Generator.getSourceCode(shaderProgram.vertexAst,
                                         '\\n') +
        '\n//! FRAGMENT\n' +
        glslunit.Generator.getSourceCode(shaderProgram.fragmentAst,
                                         '\\n');
  }
  if (goog.node.FLAGS.output) {
    fs.writeFileSync(goog.node.FLAGS.output, output);
  } else {
    process.stdout.write(output);
  }

  if (goog.node.FLAGS.uniform_and_mode_output) {
    fs.writeFileSync(
        goog.node.FLAGS.uniform_and_mode_output,
        glslunit.compiler.ShaderClassGenerator.generateUniformAndModes(
            shaderProgram));
  }

  if (goog.node.FLAGS.source_output) {
    fs.writeFileSync(
        goog.node.FLAGS.source_output,
        glslunit.compiler.ShaderClassGenerator.generateSourceClass(
            originalProgram));
  }
}

main();

