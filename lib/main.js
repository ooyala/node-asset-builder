
var gm = require('gm'),
    path = require('path'),
    _ = require('underscore'),
    fs = require('fs'),
    findit = require('findit'),
    mkdirp = require("mkdirp").mkdirp,
    stylus = require('stylus')

    FUNC_HEADER = "  (function(OO) { ",
    FUNC_FOOTER = "  }(<%= contextName %>));",
    IMG_HASH_ASSIGN_HEADER = "    OO.<%= imgHashName %> = {";
    CSS_HASH_ASSIGN_HEADER = "    OO.<%= cssHashName %> = {";
    HASH_ASSIGN_FOOTER = "      __end_marker:1 };";
    FILE_ENCODING = 'utf-8',
    EOL = '\n';

/**
 * Expose `NodeAssetBuilder`.
 */

exports = module.exports = NodeAssetBuilder;

/**
 * Library version.
 */

exports.version = '0.0.6';

function NodeAssetBuilder(options) {
  options = options || {};
  this.options = options;
  this.options.imageFolder = this.options.imageFolder || 'assets';
  this.options.cssFolder = this.options.cssFolder || 'stylus';
  this.options.tempFolder = this.options.tempFolder || 'temp';
  this.options.contextName = this.options.contextName || 'OO';
  this.options.imgHashName = this.options.imgHashName || 'asset_list';
  this.options.cssHashName = this.options.cssHashName || 'stylus_css';
  this.options.outputPath = this.options.outputPath || 'src/autogen';
  this.options.cssContainerSelector = this.options.cssContainerSelector || '#<%= elementId %>';
  var random = Math.random().toString(36).substring(7);
  this.fullTempFolder = path.resolve(this.options.tempFolder) + "/" + random;
  this.counter = 0;
}

function getSafeCssString(value) {
  if (!value) { return ''; }
  return value.replace(/\"/g, "'").replace(/\n/g, "");
}

function getCssTemplateString(value, containerSelector) {
  return value.replace(/MJOLNIR_WRAPPER_ELEMENT/g, containerSelector);
}

/** Add member functions **/

_.extend(NodeAssetBuilder.prototype, {
  fileContentToBase64: function(filePath, prefix) {
    if (!path.existsSync(filePath)) { return ''; }
    var content = fs.readFileSync(filePath);
    var base64 = content.toString('base64');
    var dataUriPrefix = (typeof(prefix) === "string") ? prefix : "data:image/png;base64,";
    return dataUriPrefix + base64;
  },

  genImageDataUriHash: function() {
    this._minfiedPngFile();
  },

  getMinifiedCssString: function(cssString, key) {
    var result = '';
    baseNameWithExt = key || 'key';
    stylus(cssString).set('compress', true).include(require('nib').path).render(function(err, css){
      result = "      '" + baseNameWithExt + "' : \"";
      result += getSafeCssString(css) + "\",";
    });
    return result;
  },

  genMinifiedCssHash: function() {
    var target = path.resolve(this.options.cssFolder);
    if (!path.existsSync(target)) { return; }
    var files = findit.sync(target);
    var outputPath = path.resolve(this.options.outputPath);
    mkdirp.sync(outputPath);

    var output = [];
    output.push(_.template(FUNC_HEADER)(this.options));
    output.push(_.template(CSS_HASH_ASSIGN_HEADER)(this.options));
    var selector = this.options.cssContainerSelector;
    var minifierFunc = _.bind(this.getMinifiedCssString, this);
    _.each(files, function(file) {

      var baseNameWithExt = file.substr(file.lastIndexOf("/") + 1);
      var cssString = fs.readFileSync(file, FILE_ENCODING);
      output.push(minifierFunc(cssString, baseNameWithExt));
    });
    output.push(_.template(HASH_ASSIGN_FOOTER)(this.options));
    output.push(_.template(FUNC_FOOTER)(this.options));
    var value = getCssTemplateString(output.join(EOL), selector);
    var outputPath = path.resolve(this.options.outputPath);
    mkdirp.sync(outputPath);
    fs.writeFileSync(outputPath  + "/" + this.options.cssHashName + ".js", value, FILE_ENCODING);
  },

  _waitForImgFinished: function(counter) {
    this.counter++;
    if (this.counter >= counter) { this._genDataUriFromImg(); }
  },

  _genDataUriFromImg: function() {
    var files = findit.sync(this.fullTempFolder);
    var output = [];
    output.push(FUNC_HEADER);
    output.push(IMG_HASH_ASSIGN_HEADER);
    var getBase64 = _.bind(this.fileContentToBase64, this);
    _.each(files, function(file) {
      var baseNameWithExt = file.substr(file.lastIndexOf("/") + 1);
      var baseName = baseNameWithExt.substring(0, baseNameWithExt.lastIndexOf('.'));
      var value = "      'image/png:" + baseName + "' : '" + getBase64(file) + "',";
      output.push(value);
    });
    output.push(HASH_ASSIGN_FOOTER);
    output.push(FUNC_FOOTER);
    var value = _.template(output.join(EOL))(this.options);
    var outputPath = path.resolve(this.options.outputPath);
    mkdirp.sync(outputPath);
    fs.writeFileSync(outputPath  + "/" + this.options.imgHashName + ".js", value, FILE_ENCODING);
    try { fs.rmdirSync(this.fullTempFolder); } catch(err) {};
  },

  _minfiedPngFile: function() {
    var absoluteSrc = path.resolve(this.options.imageFolder);
    if (!path.existsSync(absoluteSrc)) { return; }

    try { fs.rmdirSync(this.fullTempFolder); } catch(err) {};
    mkdirp.sync(this.fullTempFolder);

    var files = findit.sync(absoluteSrc);
    var target =  this.fullTempFolder + "/";
    this.counter = 0;
    var callback = _.bind(this._waitForImgFinished, this);
    _.each(files, function(file) {
       // Add this file to the list of files
       var baseNameWithExt = file.substr(file.lastIndexOf("/") + 1);
       var baseName = baseNameWithExt.substring(0, baseNameWithExt.lastIndexOf('.'));
       var outputFile = target + baseName + '.png';
       gm(file).noProfile().quality(0).write(outputFile, function(err) {
         if (err) { console.log(err); }
         callback(files.length);
       });
    });

  },

  __end_marker: true
});


