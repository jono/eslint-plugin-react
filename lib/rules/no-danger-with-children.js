/**
 * @fileoverview Report when a DOM element is using both children and dangerouslySetInnerHTML
 * @author David Petersen
 */
'use strict';

const variableUtil = require('../util/variable');

// ------------------------------------------------------------------------------
// Rule Definition
// ------------------------------------------------------------------------------
module.exports = {
  meta: {
    docs: {
      description: 'Report when a DOM element is using both children and dangerouslySetInnerHTML',
      category: '',
      recommended: true
    },
    schema: [] // no options
  },
  create: function(context) {
    function findSpreadVariable(name) {
      return variableUtil.variablesInScope(context).find(function (item) {
        return item.name === name;
      });
    }
    /**
     * Takes a ObjectExpression and returns the value of the prop if it has it
     * @param {object} node - ObjectExpression node
     * @param {string} propName - name of the prop to look for
     */
    function findObjectProp(node, propName) {
      if (!node.properties) {
        return false;
      }
      return node.properties.find(function(prop) {
        if (prop.type === 'Property') {
          return prop.key.name === propName;
        } else if (prop.type === 'ExperimentalSpreadProperty') {
          const variable = findSpreadVariable(prop.argument.name);
          if (variable && variable.defs[0].node.init) {
            return findObjectProp(variable.defs[0].node.init, propName);
          }
        }
        return false;
      });
    }

    /**
     * Takes a JSXElement and returns the value of the prop if it has it
     * @param {object} node - JSXElement node
     * @param {string} propName - name of the prop to look for
     */
    function findJsxProp(node, propName) {
      const attributes = node.openingElement.attributes;
      return attributes.find(function (attribute) {
        if (attribute.type === 'JSXSpreadAttribute') {
          const variable = findSpreadVariable(attribute.argument.name);
          if (variable && variable.defs.length && variable.defs[0].node.init) {
            return findObjectProp(variable.defs[0].node.init, propName);
          }
        }
        return attribute.name && attribute.name.name === propName;
      });
    }

    return {
      JSXElement: function (node) {
        let hasChildren = false;

        if (node.children.length) {
          hasChildren = true;
        } else if (findJsxProp(node, 'children')) {
          hasChildren = true;
        }

        if (
          node.openingElement.attributes
          && hasChildren
          && findJsxProp(node, 'dangerouslySetInnerHTML')
        ) {
          context.report(node, 'Only set one of `children` or `props.dangerouslySetInnerHTML`');
        }
      },
      CallExpression: function (node) {
        if (
          node.callee
          && node.callee.type === 'MemberExpression'
          && node.callee.property.name === 'createElement'
          && node.arguments.length > 1
        ) {
          let hasChildren = false;

          let props = node.arguments[1];

          if (props.type === 'Identifier') {
            const variable = variableUtil.variablesInScope(context).find(function (item) {
              return item.name === props.name;
            });
            if (variable && variable.defs[0].node.init) {
              props = variable.defs[0].node.init;
            }
          }

          const dangerously = findObjectProp(props, 'dangerouslySetInnerHTML');

          if (node.arguments.length === 2) {
            if (findObjectProp(props, 'children')) {
              hasChildren = true;
            }
          } else {
            hasChildren = true;
          }

          if (dangerously && hasChildren) {
            context.report(node, 'Only set one of `children` or `props.dangerouslySetInnerHTML`');
          }
        }
      }
    };
  }
};
