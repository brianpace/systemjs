/*
 * Supports loading System.register via script tag injection
 */

import { systemJSPrototype } from '../system-core';
import { hasDocument, baseUrl, resolveUrl } from '../common';

const systemRegister = systemJSPrototype.register;
systemJSPrototype.register = function (deps, declare) {
  systemRegister.call(this, deps, declare);
};

systemJSPrototype.instantiate = function (url, firstParentUrl) {
  const loader = this;
  return new Promise(function (resolve, reject) {
    let err;

    function windowErrorListener(evt) {
      if (evt.filename === url)
        err = evt.error;
    }

    window.addEventListener('error', windowErrorListener);

    const script = document.createElement('script');
    script.charset = 'utf-8';
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.addEventListener('error', function () {
      window.removeEventListener('error', windowErrorListener);
      reject(Error('Error loading ' + url + (firstParentUrl ? ' from ' + firstParentUrl : '')));
    });
    script.addEventListener('load', function () {
      window.removeEventListener('error', windowErrorListener);
      document.head.removeChild(script);
      // Note that if an error occurs that isn't caught by this if statement,
      // that getRegister will return null and a "did not instantiate" error will be thrown.
      if (err) {
        reject(err);
      }
      else {
        resolve(loader.getRegister());
      }
    });
    script.src = url;
    document.head.appendChild(script);
  });
};

if (hasDocument) {
  window.addEventListener('DOMContentLoaded', loadScriptModules);
  loadScriptModules();
}

function loadScriptModules() {
  let moduleIds = [];

  Array.prototype.forEach.call(
    document.querySelectorAll('script[type=systemjs-module]'), function (script) {
      if (script.src) {
        moduleIds.push(script.src.slice(0, 7) === 'import:' ? script.src.slice(7) : resolveUrl(script.src, baseUrl));
      }
    });

  let loadPromises = moduleIds.map(id => {
    return System.import(id, undefined, true);
  });

  Promise.all(loadPromises)
    .then(loads => {
      // Since the topLevelLoad function was changed to return the load
      // object when delayExecution = true, loads should be an array
      // of load objects.

      // Need to wait for all modules to be instantiated.
      return Promise.all(loads.map(load => load.C))
        .then(() => {
          loads.reduce((promise, load) => {
            return promise.then(() => {
              return System.execute(load);
            });
          }, Promise.resolve());
        });
    });
}