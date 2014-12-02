(function() {
  'use strict';

  var Gn={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#x27;"}

  function isNumeric(value) {
    return /^\d+$/.test(value);
  }

  function parsePath(path) {
    var originalPath = path;
    var steps = [];
    var error = false;
    var firstKey = path.substr(0, path.indexOf('['));
    if (!firstKey.length) {
      error = true;
    } else {
      path = path.substr(path.indexOf('['), path.length);
      steps.push({
        key: firstKey,
        last: !path.length,
        type:'object'
      });
    }

    var key;
    key = path.substr(1, path.indexOf(']')-1);

    while (path.length && !error) {
      if (path[0] === '[' && path[1] === ']') {
        steps.push({
          append: true,
          type: 'array'
        });
        path = path.substr(2, path.length);
        error = path.length !== 0;
      } else if (isNumeric(key = path.substr(1, path.indexOf(']')-1))) {
        key = parseInt(key, 10);
        path = path.substr(path.indexOf(']')+1, path.length);
        steps.push({
          key: key,
          type: 'array'
        })
      } else if ((key = path.substr(1, path.indexOf(']')-1)) && key.indexOf('[') === -1) {
        path = path.substr(path.indexOf(']')+1, path.length);
        steps.push({
          key: key,
          type: 'object'
        });
      } else {
        error = true;
      }
    }

    if (error) {
      steps = [{
        key: originalPath,
        last: true,
        type: 'object'
      }];
    } else {
      for (var i = 0; i < steps.length; i++) {
        var step = steps[i];
        var nextStep = steps[i+1];
        if (nextStep) {
          step.nextType = nextStep.type;
        } else {
          step.last = true;
        }
      }
    }

    return steps;
  }

  function setValue(context, step, currentValue, entryValue, isFile) {
    if (isFile) {
      entryValue = {
        name: 'filename',
        type: 'filetype',
        body: 'filebody'
      }
    }
    if (step.last) {
      if (typeof currentValue === 'undefined') {
        if (step.append) {
          context.push(entryValue);
        } else {
          context[step.key] = entryValue;
        }
      } else if (currentValue.constructor == Array) {
        context[step.key].push(entryValue);
      } else if (currentValue.constructor == Object && !isFile) {
        return setValue(currentValue, {key:'', last:true, type:'object'}, currentValue[''], entryValue, isFile);

      } else {
        context[step.key] = [currentValue, entryValue];
      }
      return context;
    }

    if (typeof currentValue === 'undefined') {
      if (step.nextType === 'array') {
        context[step.key] = [];
      } else {
        context[step.key] = {};
      }
      return context[step.key];
    } else if (currentValue.constructor === Object) {
      return context[step.key];
    } else if (currentValue.constructor === Array) {
      if (step.nextType === 'array') {
        return currentValue;
      } else {
        var object = {};
        currentValue.forEach(function(item, i) {
          if (typeof item !== 'undefined') {
            object[i] = item;
          } else {
            context[step.key] = object;
          }
        });
        return object;
      }
    } else {
      var object = {'': currentValue};
      context[step.key] = object;
      return object;
    }
  }

  function JSONencode(inputs) {
    var resultingObject = {};

    inputs.forEach(function(input) {
      var isFile = input.value && input.value.body !== undefined;
      var steps = parsePath(input.name);
      var context = resultingObject;
      for (var i = 0; i < steps.length; i++) {
        var step = steps[i];
        var currentValue = context[step.key];
        context = setValue(context, step, currentValue, input.value, isFile);
      }
    });

    return resultingObject;
    var result = JSON.stringify(resultingObject);
    return result;
  }


  $.fn.JSONencode = function() {
    var e;
    var entries = $(this).map(function() {
      e = $.prop(this, 'elements');
      if (e) {
        return $.makeArray(e);
      } else {
        return this;
      }
    }).filter(function() {
      e = this.type;
      return this.name && !$(this).is(':disabled');
    }).map(function(e, t) {
      var n;
      n = $(this).val();
      if (this.type === 'number') {
        n = parseInt(n, 10);
        return {
          name: t.name,
          value: n
        };
      }
      if (this.type === 'checkbox') {
        n = $(this).is(':checked');
        return {
          name: t.name,
          value: n
        };
      }
      if (n === null) {
        return null;
      } else {
        if ($.isArray(n)) {
          return $.map(n, function(e) {
            return {
              name: t.name,
              value: e.replace(Gn, "\r\n")
            };
          });
        } else {
          return {
            name: t.name,
            value: n.replace(Gn, "\r\n")
          };
        }
      }
    }).get();
    return JSONencode(entries);
  };

  function JSONformSubmitHandler(e) {
    e.preventDefault();
    $.ajax({
      contentType: 'application/json; charset=utf-8',
      data: JSON.stringify($(this).JSONencode()),
      dataType: 'json',
      type: 'post',
      url: this.action,
      success: function(data, textStatus, request){
        var redirect = request.getResponseHeader('Location') || data.redirect;
        if (redirect) window.location.href = redirect;
      }
    });
  };

  $.JSONforms = {
    enable: function() {
      $('body').on('submit', 'form[enctype="application/json"]', JSONformSubmitHandler);
    },
    disable: function() {
      $('body').off('submit', 'form[enctype="application/json"]', JSONformSubmitHandler);
    }
  }

  $(document).ready(function() {
    $.JSONforms.enable();
  });
})();
