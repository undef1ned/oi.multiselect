angular.module('oi.multiselect', ['template/multiselect/template.html']);

angular.module("template/multiselect/template.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("template/multiselect/template.html",
    "<div class=\"multiselect-search\" ng-class=\"{open: isOpen, focused: isFocused, loading: showLoader}\" ng-click=\"setFocus($event)\">\n" +
    "    <ul class=\"multiselect-search-list\">\n" +
    "        <li class=\"btn btn-default btn-xs multiselect-search-list-item multiselect-search-list-item_selection\"\n" +
    "            ng-repeat=\"item in output track by $index\"\n" +
    "            ng-class=\"{focused: backspaceFocus && $last}\"\n" +
    "            ng-click=\"removeItem($index)\"\n" +
    "            ng-bind-html=\"getSearchLabel(item)\"></li>\n" +
    "        <li class=\"multiselect-search-list-item multiselect-search-list-item_input\"><input autocomplete=\"off\"\n" +
    "                                                                                           ng-model=\"query\"\n" +
    "                                                                                           ng-style=\"{'width': inputWidth + 'px'}\"\n" +
    "                                                                                           ng-keydown=\"keyParser($event)\"\n" +
    "                                                                                           ng-focus=\"setFocus($event)\"/></li>\n" +
    "        <li class=\"multiselect-search-list-item multiselect-search-list-item_loader\" ng-show=\"showLoader\"></li>\n" +
    "    </ul>\n" +
    "</div>\n" +
    "<div class=\"multiselect-dropdown\" ng-show=\"isOpen\" ng-click=\"setFocus($event)\">\n" +
    "    <ul ng-if=\"isOpen\" class=\"multiselect-dropdown-optgroup\" ng-repeat=\"(group, options) in groups\">\n" +
    "        <div class=\"multiselect-dropdown-optgroup-header\"\n" +
    "            ng-if=\"group && options.length\"\n" +
    "            ng-bind=\"group\"></div><!-- we use fast getElementsByTagName('li')-->\n" +
    "        <li class=\"multiselect-dropdown-optgroup-option\"\n" +
    "            ng-repeat=\"option in options\"\n" +
    "            ng-class=\"{'active': selectorPosition === groupPos[group] + $index}\"\n" +
    "            ng-click=\"addItem(option)\"\n" +
    "            ng-mouseenter=\"setSelection(groupPos[group] + $index)\"\n" +
    "            ng-bind-html=\"getDropdownLabel(option)\"></li>\n" +
    "    </ul>\n" +
    "</div>");
}]);

angular.module('oi.multiselect')

.provider('oiMultiselect', function() {
    return {
        options: {
            debounce: 500,
            searchFilter: 'oiMultiselectCloseIcon',
            dropdownFilter: 'oiMultiselectHighlight',
            listFilter: 'oiMultiselectAscSort',
            saveLastQuery: null,
            newItem: false,
            saveTrigger: 'enter, backslash'
        },
        $get: function() {
            return {
                options: this.options
            };
        }
    };
})

.factory('oiUtils', ['$document', function($document) {
    /**
     * Measures the width of a string within a
     * parent element (in pixels).
     *
     * @param {string} str
     * @param {object} $parent
     * @returns {int}
     */
    function measureString(str, $parent) {
        var $mirror = angular.element('<mirror>').css({
            position: 'absolute',
            width: 'auto',
            padding: 0,
            whiteSpace: 'pre',
            visibility: 'hidden',
            'z-index': -99999
        }).text(str || '');

        transferStyles($parent, $mirror, 'letterSpacing fontSize fontFamily fontWeight textTransform'.split(' '));

        $document[0].body.appendChild($mirror[0]);

        var width = $mirror[0].offsetWidth;
        $mirror.remove();

        return width;
    }

    /**
     * Copies CSS properties from one element to another.
     *
     * @param {object} $from
     * @param {object} $to
     * @param {array} properties
     */
    function transferStyles($from, $to, properties) {
        var stylesTo = {},
            stylesFrom = getComputedStyle($from[0], '');

        for (var i = 0, n = properties.length; i < n; i++) {
            stylesTo[properties[i]] = stylesFrom[properties[i]];
        }

        $to.css(stylesTo);
    }

    /**
     * Sets the selected item in the dropdown menu
     * of available options.
     *
     * @param {object} list
     * @param {object} item
     */
    function scrollActiveOption(list, item) {
        var y, height_menu, height_item, scroll, scroll_top, scroll_bottom;

        if (item) {
            height_menu   = list.offsetHeight;
            height_item   = getWidthOrHeight(item, 'height', 'margin'); //outerHeight(true);
            scroll        = list.scrollTop || 0;
            y             = getOffset(item).top - getOffset(list).top + scroll;
            scroll_top    = y;
            scroll_bottom = y - height_menu + height_item;

            //TODO Make animation
            if (y + height_item > height_menu + scroll) {
                list.scrollTop = scroll_bottom;
            } else if (y < scroll) {
                list.scrollTop = scroll_top;
            }
        }
    }

    // Used for matching numbers
    var core_pnum = /[+-]?(?:\d*\.|)\d+(?:[eE][+-]?\d+|)/.source;
    var rnumnonpx = new RegExp( "^(" + core_pnum + ")(?!px)[a-z%]+$", "i" );

    function augmentWidthOrHeight(elem, name, extra, isBorderBox, styles) {
        var i = extra === (isBorderBox ? 'border' : 'content') ?
                // If we already have the right measurement, avoid augmentation
                4 :
                // Otherwise initialize for horizontal or vertical properties
                    name === 'width' ? 1 : 0,

            val = 0,
            cssExpand = ['Top','Right','Bottom','Left'];

        //TODO Use angular.element.css instead of getStyleValue after https://github.com/caitp/angular.js/commit/92bbb5e225253ebddd38ef5735d66ffef76b6a14 will be applied
        function getStyleValue(name) {
            return parseFloat(styles[name]);
        }

        for (; i < 4; i += 2) {
            // both box models exclude margin, so add it if we want it
            if (extra === 'margin') {
                val += getStyleValue(extra + cssExpand[i]);
            }

            if ( isBorderBox ) {
                // border-box includes padding, so remove it if we want content
                if (extra === 'content') {
                    val -= getStyleValue('padding' + cssExpand[i]);
                }

                // at this point, extra isn't border nor margin, so remove border
                if (extra !== 'margin') {
                    val -= getStyleValue('border' + cssExpand[i] + 'Width');
                }
            } else {
                val += getStyleValue('padding' + cssExpand[i]);

                // at this point, extra isn't content nor padding, so add border
                if (extra !== 'padding') {
                    val += getStyleValue('border' + cssExpand[i] + 'Width');
                }
            }
        }

        return val;
    }

    function getOffset(elem) {
        var docElem, win,
            box = elem.getBoundingClientRect(),
            doc = elem && elem.ownerDocument;

        if (!doc) {
            return;
        }

        docElem = doc.documentElement;
        win = getWindow(doc);

        return {
            top: box.top + win.pageYOffset - docElem.clientTop,
            left: box.left + win.pageXOffset - docElem.clientLeft
        };
    }

    function getWindow(elem) {
        return elem != null && elem === elem.window ? elem : elem.nodeType === 9 && elem.defaultView;
    }

    function getWidthOrHeight(elem, name, extra) {

        // Start with offset property, which is equivalent to the border-box value
        var valueIsBorderBox = true,
            val = name === 'width' ? elem.offsetWidth : elem.offsetHeight,
            styles = window.getComputedStyle(elem, null),

        //TODO Make isBorderBox after https://github.com/caitp/angular.js/commit/92bbb5e225253ebddd38ef5735d66ffef76b6a14 will be applied
            isBorderBox = false; //jQuery.support.boxSizing && jQuery.css( elem, "boxSizing", false, styles ) === "border-box";

        // some non-html elements return undefined for offsetWidth, so check for null/undefined
        // svg - https://bugzilla.mozilla.org/show_bug.cgi?id=649285
        // MathML - https://bugzilla.mozilla.org/show_bug.cgi?id=491668
        if (val <= 0 || val == null) {
            // Fall back to computed then uncomputed css if necessary
            val = styles[name];

            if (val < 0 || val == null) {
                val = elem.style[name];
            }

            // Computed unit is not pixels. Stop here and return.
            if (rnumnonpx.test(val)) {
                return val;
            }

            // we need the check for style in case a browser which returns unreliable values
            // for getComputedStyle silently falls back to the reliable elem.style
            //valueIsBorderBox = isBorderBox && ( jQuery.support.boxSizingReliable || val === elem.style[ name ] );

            // Normalize "", auto, and prepare for extra
            val = parseFloat(val) || 0;
        }

        // use the active box-sizing model to add/subtract irrelevant styles
        return val + augmentWidthOrHeight(elem, name, extra || ( isBorderBox ? "border" : "content" ), valueIsBorderBox, styles);
    }

    function copyWidth(srcElement, dstElement) {
        dstElement.css('width', getWidthOrHeight(srcElement[0], 'width', 'margin') + 'px');
    }

    function groupsIsEmpty(groups) {
        for (var k in groups) {
            if (groups.hasOwnProperty(k) && groups[k].length) {
                return false;
            }
        }
        return true;
    }

    function objToArr(obj) {
        var arr = [];

        angular.forEach(obj, function(value, key) {
            if (key.toString().charAt(0) !== '$') {
                arr.push(value);
            }
        });

        return arr;
    }

    //lodash _.isEqual
    function isEqual(x, y) {
        if ( x === y ) return true;
        if ( ! ( x instanceof Object ) || ! ( y instanceof Object ) ) return false;
        if ( x.constructor !== y.constructor ) return false;

        for ( var p in x ) {
            if ( ! x.hasOwnProperty( p ) ) continue;
            if ( ! y.hasOwnProperty( p ) ) return false;
            if ( x[ p ] === y[ p ] ) continue;
            if ( typeof( x[ p ] ) !== "object" ) return false;
            if ( ! objectEquals( x[ p ],  y[ p ] ) ) return false;
        }

        for ( p in y ) {
            if ( y.hasOwnProperty( p ) && ! x.hasOwnProperty( p ) ) return false;
        }
        return true;
    }

    function isPart(y, x){
        if ( x === y ) return true;
        if ( ! ( x instanceof Object ) || ! ( y instanceof Object ) ) return false;

        for ( var p in x ) {
            if ( ! x.hasOwnProperty( p ) ) continue;
            if ( ! y.hasOwnProperty( p ) ) return false;
            if ( x[ p ] === y[ p ] ) continue;
            if ( typeof( x[ p ] ) !== "object" ) return false;
            if ( ! objectEquals( x[ p ],  y[ p ] ) ) return false;
        }

        return true;

    }

    //lodash _.intersection + filter + callback + invert
    function intersection(xArr, yArr, callback, xFilter, yFilter, invert) {
        var i, j, n, filteredX, filteredY, out = invert ? [].concat(xArr) : [];

        callback = callback || function(xValue, yValue) {
            return xValue === yValue;
        };

        for (i = 0, n = xArr.length; i < xArr.length; i++) {
            filteredX = xFilter ? xFilter(xArr[i]) : xArr[i];

            for (j = 0; j < yArr.length; j++) {
                filteredY = yFilter ? yFilter(yArr[j]) : yArr[j];

                if (callback(filteredX, filteredY, xArr, yArr, i, j)) {
                    invert ? out.splice(i + out.length - n, 1) : out.push(xArr[i]);
                    break;
                }
            }
        }
        return out;
    }

    function getValue(valueName, item, scope, getter) {
        var locals = {};

        //'name.subname' -> {name: {subname: list}}'
        valueName.split('.').reduce(function(previousValue, currentItem, index, arr) {
            return previousValue[currentItem] = index < arr.length - 1 ? {} : item;
        }, locals);

        return getter(scope, locals);
    }

    return {
        copyWidth:          copyWidth,
        measureString:      measureString,
        scrollActiveOption: scrollActiveOption,
        groupsIsEmpty:      groupsIsEmpty,
        objToArr:           objToArr,
        getValue:           getValue,
        isEqual:            isEqual,
        isPart:             isPart,
        intersection:       intersection
    }
}]);
angular.module('oi.multiselect')
    
.directive('oiMultiselect', ['$document', '$q', '$timeout', '$parse', '$interpolate', '$injector', '$filter', 'oiUtils', 'oiMultiselect', function($document, $q, $timeout, $parse, $interpolate, $injector, $filter, oiUtils, oiMultiselect) {
    var NG_OPTIONS_REGEXP = /^\s*([\s\S]+?)(?:\s+as\s+([\s\S]+?))?(?:\s+group\s+by\s+([\s\S]+?))?\s+for\s+(?:([\$\w][\$\w]*)|(?:\(\s*([\$\w][\$\w]*)\s*,\s*([\$\w][\$\w]*)\s*\)))\s+in\s+([\s\S]+?)(?:\s+track\s+by\s+([\s\S]+?))?$/,
        VALUES_REGEXP     = /([^\(\)\s\|\s]*)\s*(\(.*\))?\s*(\|?\s*.+)?/;

    return {
        restrict: 'AE',
        templateUrl: 'template/multiselect/template.html',
        require: 'ngModel',
        scope: {},
        compile: function (element, attrs) {
            var optionsExp = attrs.ngOptions,
                match;

            if (!(match = optionsExp.match(NG_OPTIONS_REGEXP))) {
                throw new Error("Expected expression in form of '_select_ (as _label_)? for (_key_,)?_value_ in _collection_'");
            }

            var selectAsName         = / as /.test(match[0]) && match[1],    //item.modelValue
                displayName          = match[2] || match[1],                 //item.label
                valueName            = match[4] || match[6],                 //item
                groupByName          = match[3] || '',                       //item.groupName
                trackByName          = match[8] || displayName,              //item.id
                valueMatches         = match[7].match(VALUES_REGEXP);        //collection

            var valuesName           = valueMatches[1],                      //collection
                filteredValuesName   = valuesName + (valueMatches[3] || ''), //collection | filter
                valuesFnName         = valuesName + (valueMatches[2] || ''); //collection()

            var selectAsFn           = selectAsName && $parse(selectAsName),
                displayFn            = $parse(displayName),
                groupByFn            = $parse(groupByName),
                filteredValuesFn     = $parse(filteredValuesName),
                valuesFn             = $parse(valuesFnName),
                trackByFn            = $parse(trackByName);

            var multiple             = angular.isDefined(attrs.multiple),
                multipleLimit        = Number(attrs.multipleLimit),
                placeholderFn        = $interpolate(attrs.placeholder || ''),
                keyUpDownWerePressed = false,
                matchesWereReset     = false,
                optionsFn            = $parse(attrs.oiMultiselectOptions);

            var modelContains = $parse(attrs.modelContains);

            var timeoutPromise,
                lastQuery;

            return function(scope, element, attrs, ctrl) {
                var inputElement = element.find('input'),
                    listElement  = angular.element(element[0].querySelector('.multiselect-dropdown')),
                    placeholder  = placeholderFn(scope),
                    options      = angular.extend({}, oiMultiselect.options, optionsFn(scope.$parent)),
                    lastQueryFn  = options.saveLastQuery ? $injector.get(options.saveLastQuery) : function() {return ''};

                options.newItemModelFn = function (query) {
                    return (optionsFn({$query: query}) || {}).newItemModel || query;
                };

                if (angular.isDefined(attrs.autofocus)) {
                    $timeout(function() {
                        inputElement[0].focus();
                    });
                }

                if (angular.isDefined(attrs.readonly)) {
                    inputElement.attr('readonly', true)
                }

                attrs.$observe('disabled', function(value) {
                    inputElement.prop('disabled', value);
                });

                scope.$parent.$watch(attrs.ngModel, function(value) {
                    adjustInput();

                    var output = value instanceof Array ? value : value ? [value]: [],
                        promise = $q.when(output);

                    if (selectAsFn && value) {
                        promise = getMatches(null, value)
                            .then(function(collection) {
                                return oiUtils.intersection(collection, output, modelContains ? oiUtils.isPart : oiUtils.isEqual, selectAs);
                            });
                        timeoutPromise = null; //`resetMatches` should not cancel the `promise`
                    }

                    promise.then(function(collection) {
                        scope.output = collection;

                        if (collection.length !== output.length) {
                            scope.removeItem(collection.length); //if newItem was not created
                        }
                    });
                });

                scope.$watch('query', function(inputValue, oldValue) {
                    adjustInput();

                    //We don't get matches if nothing added into matches list
                    if (inputValue !== oldValue && (!scope.oldQuery || inputValue) && !matchesWereReset) {
                        listElement[0].scrollTop = 0;

                        if (inputValue) {
                            getMatches(inputValue);
                            scope.oldQuery = null;
                        } else {
                            resetMatches();
                            matchesWereReset = true;
                        }
                    }
                    matchesWereReset = false;
                });

                scope.$watch('groups', function(groups) {
                    if (oiUtils.groupsIsEmpty(groups)) {
                        scope.isOpen = false;

                    } else if (!scope.isOpen && !attrs.disabled) {
                        scope.isOpen = true;
                        scope.isFocused = true;
                        oiUtils.copyWidth(element, listElement);
                    }
                });

                scope.$watch('isFocused', function(isFocused) {
                    if (isFocused) {
                        element.triggerHandler('focus');
                        $document.on('click', blurHandler);
                    }
                });

                scope.setFocus = function(event) {
                    if (attrs.disabled) return;

                    scope.backspaceFocus = false;

                    if (event.target.nodeName !== 'INPUT') {
                        inputElement[0].focus();
                    }

                    if (event.type === 'focus' && !scope.isOpen && !scope.isFocused) {
                        scope.isFocused = true;

                        return;
                    }

                    if (event.type === 'click' && angular.element(event.target).scope() === this) { //not click on add or remove buttons
                        if (scope.isOpen && !scope.query) {
                            resetMatches();
                        } else {
                            getMatches(scope.query);
                        }
                    }
                };

                scope.addItem = function addItem(option) {
                    lastQuery = scope.query;

                    //duplicate
                    if (oiUtils.intersection(scope.output, [option], null, getLabel, getLabel).length) return;

                    //limit is reached
                    if (!isNaN(multipleLimit) && scope.output.length >= multipleLimit) return;

                    var optionGroup = scope.groups[getGroupName(option)];
                    var modelOption = selectAsFn ? selectAs(option) : option;

                    optionGroup.splice(optionGroup.indexOf(option), 1);

                    if (multiple) {
                        ctrl.$setViewValue(angular.isArray(ctrl.$modelValue) ? ctrl.$modelValue.concat(modelOption) : [modelOption]);
                        updateGroupPos();
                    } else {
                        ctrl.$setViewValue(modelOption);
                        resetMatches();
                    }

                    if (oiUtils.groupsIsEmpty(scope.groups)) {
                        scope.groups = {}; //it is necessary for groups watcher
                    }

                    scope.oldQuery = scope.oldQuery || scope.query;
                    scope.query = '';
                    scope.backspaceFocus = false;

                    adjustInput();
                };

                scope.removeItem = function removeItem(position) {
                    var removedValue;

                    if (attrs.disabled) return;

                    if (multiple && position >= 0) {
                        removedValue = ctrl.$modelValue[position];
                        ctrl.$modelValue.splice(position, 1);
                        ctrl.$setViewValue([].concat(ctrl.$modelValue));

                    } else if (!angular.isDefined(attrs.notempty)) {
                        removedValue = ctrl.$modelValue;
                        ctrl.$setViewValue(undefined);
                    }

                    scope.query = lastQueryFn(removedValue, lastQuery);

                    if (scope.isOpen || scope.oldQuery || !multiple) {
                        getMatches(scope.oldQuery); //stay old list
                    }

                    adjustInput();
                };

                scope.setSelection = function(index) {
                    if (!keyUpDownWerePressed && scope.selectorPosition !== index) {
                        setOption(listElement, index);
                    } else {
                        keyUpDownWerePressed = false;
                    }
                };

                function saveOn(triggerName) {
                    var isTriggered    = (new RegExp(triggerName)).test(options.saveTrigger),
                        isNewItem      = options.newItem && scope.query,
                        isSelectedItem = angular.isNumber(scope.selectorPosition),
                        selectedOrder  = scope.order[scope.selectorPosition],
                        newItemFn      = options.newItemFn || options.newItemModelFn,
                        itemPromise    = $q.reject();

                    if (isTriggered && (isNewItem || isSelectedItem && selectedOrder)) {
                        scope.showLoader = true;
                        itemPromise = $q.when(triggerName !== 'blur' && selectedOrder || scope.query && newItemFn(scope.query));
                    }

                    itemPromise
                        .then(scope.addItem)
                        .finally(function() {
                            var bottom = scope.order.length - 1;

                            if (scope.selectorPosition === bottom) {
                                setOption(listElement, 0); //TODO optimise when list will be closed
                            }
                            options.newItemFn && !isSelectedItem || $timeout(angular.noop); //TODO $applyAsync work since Angular 1.3
                            resetMatches();
                        });
                }

                scope.keyParser = function keyParser(event) {
                    var top    = 0,
                        bottom = scope.order.length - 1;

                    switch (event.keyCode) {
                        case 38: /* up */
                            scope.selectorPosition = angular.isNumber(scope.selectorPosition) ? scope.selectorPosition : top;
                            setOption(listElement, scope.selectorPosition === top ? bottom : scope.selectorPosition - 1);
                            keyUpDownWerePressed = true;
                            break;

                        case 40: /* down */
                            scope.selectorPosition = angular.isNumber(scope.selectorPosition) ? scope.selectorPosition : top - 1;
                            setOption(listElement, scope.selectorPosition === bottom ? top : scope.selectorPosition + 1);
                            keyUpDownWerePressed = true;
                            if (!scope.query.length && !scope.isOpen) {
                                getMatches();
                            }
                            break;

                        case 37: /* left */
                        case 39: /* right */
                            break;

                        case 13: /* enter */
                            saveOn('enter');
                            break;
                        case 9: /* tab */
                            blurHandler();
                            break;
                        case 220: /* backslash */
                            saveOn('backslash');
                            event.preventDefault(); //backslash interpreted as a regexp
                            break;

                        case 27: /* esc */
                            resetMatches();
                            break;

                        case 8: /* backspace */
                            if (!scope.query.length) {
                                if (scope.backspaceFocus && scope.output) {
                                    scope.removeItem(scope.output.length - 1);
                                    if (!scope.output.length) {
                                        getMatches();
                                        break;
                                    }
                                }
                                scope.backspaceFocus = !scope.backspaceFocus;
                                break;
                            }
                        default: /* any key */
                            scope.backspaceFocus = false;
                            return false; //preventDefaults
                    }
                };

                scope.getSearchLabel = function(option) {
                    var label = getLabel(option);

                    if (options.searchFilter) {
                        label = $filter(options.searchFilter)(label, scope.oldQuery || scope.query, option)
                    }
                    return label;
                };

                scope.getDropdownLabel = function(option) {
                    var label = getLabel(option);

                    if (options.dropdownFilter) {
                        label = $filter(options.dropdownFilter)(label, scope.oldQuery || scope.query, option)
                    }
                    return label;
                };

                if (multiple) {
                    // Override the standard $isEmpty because an empty array means the input is empty.
                    ctrl.$isEmpty = function(value) {
                        return !value || !value.length;
                    };
                }

                resetMatches();

                function blurHandler(event) {
                    if (!event || event.target.ownerDocument.activeElement !== inputElement[0]) {
                        $timeout(function() {
                            element.triggerHandler('blur'); //conflict with current live cycle (case: multiple=none + tab)
                        });
                        saveOn('blur');
                        $document.off('click', blurHandler);
                        scope.isFocused = false;
                        scope.$evalAsync();
                    }
                }

                function adjustInput() {
                    var currentPlaceholder = ctrl.$modelValue && ctrl.$modelValue.length ? '' : placeholder;
                    inputElement.attr('placeholder', currentPlaceholder);
                    // expand input box width based on content
                    scope.inputWidth = oiUtils.measureString(scope.query || currentPlaceholder, inputElement) + 4;
                }

                function trackBy(item) {
                    return oiUtils.getValue(valueName, item, scope, trackByFn);
                }

                function selectAs(item) {
                    return oiUtils.getValue(valueName, item, scope, selectAsFn);
                }

                function getLabel(item) {
                    return oiUtils.getValue(valueName, item, scope, displayFn);
                }

                function getGroupName(option) {
                    return oiUtils.getValue(valueName, option, scope, groupByFn) || '';
                }

                function filter(list) {
                    return oiUtils.getValue(valuesName, list, scope.$parent, filteredValuesFn);
                }

                function getMatches(query, querySelectAs) {
                    var values = valuesFn(scope.$parent, {$query: query, $querySelectAs: querySelectAs}),
                        waitTime = 0;

                    scope.selectorPosition = options.newItem === 'prompt' ? false : 0;

                    if (!query && !querySelectAs) {
                        scope.oldQuery = null;
                    }

                    if (timeoutPromise && (angular.isFunction(values.then) || angular.isFunction(values.$promise))) {
                        $timeout.cancel(timeoutPromise); //cancel previous timeout
                        waitTime = options.debounce;
                    }

                    timeoutPromise = $timeout(function() {
                        scope.showLoader = true;

                        return $q.when(values.$promise || values)
                            .then(function(values) {
                                if (!querySelectAs) {
                                    var filteredList   = $filter(options.listFilter)(oiUtils.objToArr(values), query, getLabel);
                                    var withoutOverlap = oiUtils.intersection(filteredList, scope.output, modelContains ? oiUtils.isPart : oiUtils.isEqual, trackBy, trackBy, true);
                                    var filteredOutput = filter(withoutOverlap);

                                    scope.groups = group(filteredOutput);

                                    updateGroupPos();
                                }
                                return values;
                            })
                            .finally(function(){
                                scope.showLoader = false;
                            });
                    }, waitTime);

                    return timeoutPromise;
                }

                function updateGroupPos() {
                    var i, key, value, collectionKeys = [], groupCount = 0;

                    scope.order = [];
                    scope.groupPos = {};

                    for (key in scope.groups) {
                        if (scope.groups.hasOwnProperty(key) && key.charAt(0) != '$') {
                            collectionKeys.push(key);
                        }
                    }
                    collectionKeys.sort();

                    for (i = 0; i < collectionKeys.length; i++) {
                        key = collectionKeys[i];
                        value = scope.groups[key];

                        scope.order = scope.order.concat(value);
                        scope.groupPos[key] = groupCount;
                        groupCount += value.length
                    }
                }

                function resetMatches() {
                    scope.oldQuery = null;
                    scope.backspaceFocus = false; // clears focus on any chosen item for del
                    scope.query = '';
                    scope.groups = {};
                    scope.order = [];
                    scope.showLoader = false;
                    scope.isOpen   = false;

                    if (timeoutPromise) {
                        $timeout.cancel(timeoutPromise);//cancel previous timeout
                    }
                }

                function setOption(listElement, position) {
                    scope.selectorPosition = position;
                    oiUtils.scrollActiveOption(listElement[0], listElement.find('li')[position]);
                }

                function group(input) {
                    var optionGroups = {'':[]},
                        optionGroupName,
                        optionGroup;

                    for (var i = 0; i < input.length; i++) {
                        optionGroupName = getGroupName(input[i]);

                        if (!(optionGroup = optionGroups[optionGroupName])) {
                            optionGroup = optionGroups[optionGroupName] = [];
                        }
                        optionGroup.push(input[i]);
                    }

                    return optionGroups;
                }
            }
        }
    }
}]);
angular.module('oi.multiselect')

.filter('oiMultiselectCloseIcon', ['$sce', function($sce) {
    return function(label) {
        var closeIcon = '<span class="close multiselect-search-list-item_selection-remove">×</span>';

        return $sce.trustAsHtml(label + closeIcon);
    };
}])

.filter('oiMultiselectHighlight', ['$sce', function($sce) {
    return function(label, query) {

        var html;
        if (query.length > 0 || angular.isNumber(query)) {
            label = label.toString();
            query = query.toString();
            html = label.replace(new RegExp(query, 'gi'), '<strong>$&</strong>');
        } else {
            html = label;
        }

        return $sce.trustAsHtml(html);
    };
}])

.filter('oiMultiselectAscSort', function() {
    function ascSort(input, query, getLabel) {
        var i, output, output1 = [], output2 = [], output3 = [];

        if (query) {
            for (i = 0; i < input.length; i++) {
                if (getLabel(input[i]).match(new RegExp(query, "i"))) {
                    output1.push(input[i]);
                }
            }
            for (i = 0; i < output1.length; i++) {
                if (getLabel(output1[i]).match(new RegExp('^' + query, "i"))) {
                    output2.push(output1[i]);
                } else {
                    output3.push(output1[i]);
                }
            }
            output = output2.concat(output3);
        } else {
            output = [].concat(input);
        }

        return output;
    }

    return ascSort;
});