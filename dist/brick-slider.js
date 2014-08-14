/* globals Platform */

(function () {

  var currentScript = document._currentScript || document.currentScript;

  var requestAnimationFrame = window.requestAnimationFrame ||
                              window.webkitRequestAnimationFrame ||
                              function (fn) { setTimeout(fn, 16); };

  var cancelAnimationFrame = window.cancelAnimationFrame ||
                             window.mozCancelAnimationFrame;

  function shimShadowStyles(styles, tag) {
    if (!Platform.ShadowCSS) {
      return;
    }
    for (var i = 0; i < styles.length; i++) {
      var style = styles[i];
      var cssText = Platform.ShadowCSS.shimStyle(style, tag);
      Platform.ShadowCSS.addCssToDocument(cssText);
      style.remove();
    }
  }

  function copyAttributes(src, dest, exceptions) {
    var attrs = src.attributes;
    for (var i = 0; i < attrs.length; i++) {
      var attr = src.attributes[i];
      if (exceptions.indexOf(attr.name) === -1) {
        dest.setAttribute(attr.name, attr.value);
      }
    }
  }

  function isNum (num) {
    return !isNaN(parseFloat(num));
  }

  function roundToStep (rawRangeVal, step, rangeMin, roundFn) {
    roundFn = (roundFn) ? roundFn : Math.round;
    rangeMin = (isNum(rangeMin)) ? rangeMin : 0;

    step = parseFloat(step);
    rangeMin = parseFloat(rangeMin);

    if (!isNum(rawRangeVal)) {
      throw "invalid value " + rawRangeVal;
    }
    if ((!isNum(step)) || +step <= 0) {
      throw "invalid step " + step;
    }
    return roundFn((rawRangeVal - rangeMin) / step) * step + rangeMin;
  }

  function constrainToSteppedRange (value, min, max, step) {
      if (value < min) {
          return min;
      } else if (value > max) {
          // return the largest number that is a multiple of step away from
          // the range start, but is still under the max
          return Math.max(min, roundToStep(max, step, min, Math.floor));
      } else {
          return value;
      }
  }

  function fractionToCorrectedVal(brickSlider, sliderFraction) {
    sliderFraction = Math.min(Math.max(0.0, sliderFraction), 1.0);

    var rawVal = ((brickSlider.max - brickSlider.min) * sliderFraction) + brickSlider.min;

    // temporarily translate the range to start at zero for the step
    // rounding, then add back in the minimum so that the step is always in
    // relation to the start of the range, instead of starting partially
    // within the range
    var roundedVal = roundToStep(rawVal, brickSlider.step, brickSlider.min);

    var constrainedVal = constrainToSteppedRange(roundedVal, brickSlider.min, brickSlider.max, brickSlider.step);

    return constrainedVal;
  }

  function handleChange (brickSlider, x, y) {
    var inputOffsets = brickSlider.getBoundingClientRect();
    var thumbWidth = brickSlider.thumb.getBoundingClientRect().width;
    var inputPointerX = x - inputOffsets.left - thumbWidth / 2;
    var divideby = inputOffsets.width - thumbWidth;
    var value = fractionToCorrectedVal(brickSlider, inputPointerX / divideby);
    brickSlider.value = value;

    redraw(brickSlider);
  }

  function onDragStart(brickSlider, x, y) {
    brickSlider.ns.dragInitialValue = brickSlider.value;
    handleChange(brickSlider, x, y);

    brickSlider.thumb.setAttribute('active','');

    var mouseMoveListener = function (e) {
      handleChange(brickSlider, e.clientX, e.clientY);
    };
    var touchMoveListener = function (e) {
      var touch = e.touches[0];
      handleChange(brickSlider, touch.pageX, touch.pageY);
    };
    var pointerUpListener = function () {
      document.removeEventListener('mousemove', mouseMoveListener);
      document.removeEventListener('touchmove', touchMoveListener);
      document.removeEventListener('mouseup', pointerUpListener);
      brickSlider.thumb.removeAttribute('active');
    };
    document.addEventListener('mousemove', mouseMoveListener);
    document.addEventListener('touchmove', touchMoveListener);
    document.addEventListener('mouseup', pointerUpListener);
    document.addEventListener('touchend', pointerUpListener);
  }

  function redraw(brickSlider) {
    var value = brickSlider.value;
    if (brickSlider.ns.reqFrame) {
      cancelAnimationFrame(brickSlider.ns.reqFrame);
    }
    brickSlider.ns.reqFrame = requestAnimationFrame(function () {
      var sliderWidth = brickSlider.getBoundingClientRect().width;
      var thumbWidth = brickSlider.thumb.getBoundingClientRect().width;
      var fraction = (value - brickSlider.min) / (brickSlider.max - brickSlider.min);

      var availableWidth = Math.max(sliderWidth - thumbWidth, 0);
      var newHandleX = (availableWidth * fraction);

      var percentage = (100 * newHandleX / sliderWidth) + '%';

      brickSlider.thumb.style.left = percentage;
      brickSlider.range.style.width = value + "%";
      brickSlider.ns.reqFrame = null;
    });

  }

  var BrickSliderElementPrototype = Object.create(HTMLElement.prototype);

  BrickSliderElementPrototype.createdCallback = function () {

    var brickSlider = this;
    brickSlider.ns = {};

    // import template
    var importDoc = currentScript.ownerDocument;
    var templateContent = importDoc.querySelector('template').content;

    // fix styling for polyfill
    shimShadowStyles(templateContent.querySelectorAll('style'),'brick-slider');

    // create shadowRoot and append template
    var shadowRoot = brickSlider.createShadowRoot();
    shadowRoot.appendChild(templateContent.cloneNode(true));

    // get the input
    brickSlider.input = document.createElement('input');
    brickSlider.input.setAttribute('type','range');
    copyAttributes(brickSlider,brickSlider.input,['label','type']);
    brickSlider.input.style.display = 'none';
    brickSlider.appendChild(brickSlider.input);

    // the thumb and the range element
    brickSlider.thumb = shadowRoot.querySelector('.input-range-thumb');
    brickSlider.range = shadowRoot.querySelector('.input-range-range');
    // listen for initial mousedown or touchstart
    brickSlider.addEventListener('mousedown', function (e) {
      // return if it was not a left mouse button click
      if (e.button !== 0) {
        return;
      }
      onDragStart(brickSlider, e.clientX, e.clientY);
      e.preventDefault();
    });
    brickSlider.addEventListener('touchstart', function (e) {
      var touch = e.touches[0];
      onDragStart(brickSlider, touch.pageX, touch.pageY);
      e.preventDefault();
    });

    // draw the slider to have it match the current value
    redraw(brickSlider);
  };

  BrickSliderElementPrototype.attachedCallback = function () {

  };

  BrickSliderElementPrototype.detachedCallback = function () {

  };

  BrickSliderElementPrototype.attributeChangedCallback = function (attr, oldVal, newVal) {
    if (attr in attrs) {
      attrs[attr].call(this, oldVal, newVal);
    }
  };

  // Attribute handlers

  var attrs = {
    'attr': function (oldVal, newVal) {

    }
  };

  // Property handlers

  Object.defineProperties(BrickSliderElementPrototype, {
    'value': {
      get: function () {
        return parseFloat(this.input.value);
      },
      set: function (newVal) {
        this.input.value = newVal;
      }
    },
    'min': {
      get: function () {
        return parseFloat(this.input.min);
      },
      set: function (newVal) {
        this.input.min = newVal;
      }
    },
    'max': {
      get: function () {
        return parseFloat(this.input.max);
      },
      set: function (newVal) {
        this.input.max = newVal;
      }
    },
    'step': {
      get: function () {
        return parseFloat(this.input.step);
      },
      set: function (newVal) {
        this.input.step = newVal;
      }
    }
  });

  // Register the element

  window.BrickSliderElement = document.registerElement('brick-slider', {
    prototype: BrickSliderElementPrototype
  });

})();
