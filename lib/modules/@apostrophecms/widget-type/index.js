// The base class for all modules that implement a widget, such as
// [@apostrophecms/rich-text-widgets](../@apostrophecms/rich-text-widgets/index.html),
// [@apostrophecms/pieces-widget-type](../@apostrophecms/pieces-widget-type/index.html) and
// [@apostrophecms/video-widgets](../@apostrophecms/video-widgets/index.html).
//
// All widgets have a [schema](../../tutorials/getting-started/schema-guide.html).
// Many project-specific modules that extend this module consist entirely of an
// `addFields` option and a `views/widget.html` file.
//
// For more information see the [custom widgets tutorial](../../tutorials/getting-started/custom-widgets.html).
//
// ## Options
//
// ### `label`
//
// The label of the widget, as seen in menus for adding widgets.
//
// ### `name`
//
// The unique name of this type of widget, as seen in the `type` property in the database.
// It will be singular if it displays one thing, like `@apostrophecms/video`,
// and plural if it displays more than one thing, like `@apostrophecms/piece-type`.
// **By default, Apostrophe automatically removes `-widgets` from the name
// of your module to set this option for you.** This is a good convention
// but you may set this option instead if you wish.
//
// ### `playerData`
//
// By default, all of the permanent properties of your widget's schema
// are present in the page as JSON and can be accessed via the
// `data` argument of the `play` method of your browser-side object
// (see `always.js` in `@apostrophecms/images-widgets` for an example).
//
// This is often useful, but if the information is sensitive and you
// don't want it to be available in this way, set:
//
// `playerData: false`
//
// If you want the `play` method to have access to *some* of the
// properties, set:
//
// `playerData: [ 'propName1', 'propName2' ]`
//
// **When you have editing privileges, you always have access to
// 100% of the permanent properties of the widget in this way.**
// This is needed for the editing experience.
//
// ### `scene`
//
// If your widget wishes to use Apostrophe features like schemas
// when interacting with *logged-out* users — for instance, to implement
// forms conveniently — you can set the `scene` option to `user`. Any
// page that contains the widget will then load the full javascript and stylesheet
// assets normally reserved for logged-in users. Note that if a page
// relies on AJAX calls to load more content later, the assets will not be
// upgraded. So you may wish to set the `scene` option of the appropriate
// subclass of `@apostrophecms/page-type` or `@apostrophecms/pieces-page-type`, as well.
//
// ### `addFields`, `removeFields`, `arrangeFields`, etc.
//
// The standard options for building [schemas](../../tutorials/getting-started/schema-guide.html)
// are accepted. The widget will present a modal dialog box allowing the user to edit
// these fields. They are then available inside `widget.html` as properties of
// `data.widget`.
//
// ### `defer`
//
// If you set `defer: true` for a widget module, like @apostrophecms/images-widgets, the join to
// actually fetch the images is deferred until the last possible minute, right before the
// template is rendered. This can eliminate some queries and speed up your site when there
// are many separate joins happening on a page that ultimately result in loading images.
//
// If you wish this technique to also be applied to images loaded by content on the global doc,
// you can also set `deferWidgetLoading: true` for the `@apostrophecms/global` module. To avoid chicken
// and egg problems, there is still a separate query for all the images from the global doc and all
// the images from everything else, but you won't get more than one of each type.
//
// Setting `defer` to `true` may help performance for any frequently used widget type
// that depends on joins and has a `load` method that can efficiently handle multiple widgets.
//
// If you need access to the results of the join in server-side JavaScript code, outside of page
// templates, do not use this feature. Since it defers the joins to the last minute,
// that information will not be available yet in any asynchronous node.js code.
// It is the last thing to happen before the actual page template rendering.
//
// ## Important templates
//
// You will need to supply a `views/widget.html` template for your module that
// extends this module.
//
// In `views/widget.html`, you can access any schema field as a property
// of `data.widget`. You can also access options passed to the widget as
// `data.options`.
//
// ## More
//
// If your widget requires JavaScript on the browser side, you will want
// to define the browser-side singleton that manages this type of widget by
// supplying a `public/js/always.js` file. In
// that file you will override the `play` method, which receives a jQuery element containing
// the appropriate div, the `data` for the widget, and the `options` that
// were passed to the widget.
//
// For example, here is the `public/js/always.js` file for the
// [@apostrophecms/video-widgets](../@apostrophecms/video-widgets/index.html) module:
//
// ```javascript
// apos.define('@apostrophecms/video-widgets', {
//   extend: '@apostrophecms/widget-type',
//   construct: function(self, options) {
//     self.play = function($widget, data, options) {
//       return apos.oembed.queryAndPlay($widget.find('[data-apos-video-player]'), data.video);
//     };
//   }
// });
// ```
//
// **ALWAYS USE `$widget.find`, NEVER $('selector....')` to create widget players.**
// Otherwise your site will suffer from "please click refresh after you save"
// syndrome. Otherwise known as "crappy site syndrome."
//
// ## Command line tasks
//
// ```
// node app your-widget-module-name-here:list
// ```
// Lists all of the places where this widget is used on the site. This is very useful if
// you are debugging a change and need to test all of the different ways a widget has
// been used, or are wondering if you can safely remove one.

let _ = require('lodash');

module.exports = {
  options: {
    playerData: false
  },
  init(self, options) {

    self.enableBrowserData();

    self.template = options.template || 'widget';

    if (!self.options.label) {
      throw new Error('You must specify the label option when subclassing @apostrophecms/widget-type in ' + self.__meta.name);
    }

    self.label = self.options.label;
    self.name = self.options.name || self.__meta.name.replace(/-widgets$/, '');

    self.composeSchema();

    self.apos.areas.setWidgetManager(self.name, self);

    self.apos.tasks.add(self.__meta.name, 'list', 'Run this task to list all widgets of this type in the project.\n' + 'Useful for testing.\n', self.list);

  },
  methods(self, options) {
    return {

      // Compose the schema, accepting `addFields`, `removeFields`, etc.
      // as described in the schema guide. After `afterConstruct` invokes
      // this method, `self.schema` is available. Throw an error
      // if `type` is used as a field name

      composeSchema() {
        self.schema = self.apos.schemas.compose(options);
        const forbiddenFields = [
          '_id',
          'type'
        ];
        _.each(self.schema, function (field) {
          if (_.includes(forbiddenFields, field.name)) {
            throw new Error('Widget type ' + self.name + ': the field name ' + field.name + ' is forbidden');
          }
        });
      },

      // Returns markup for the widget. Invoked via `{% widget ... %}` in the
      // `@apostrophecms/areas` module as it iterates over widgets in
      // an area. The default behavior is to render the template for the widget,
      // which is by default called `widget.html`, passing it `data.widget`
      // and `data.options`. The module is accessible as `data.manager`.
      //
      // async, as are all functions that invoke a nunjucks render in
      // Apostrophe 3.x.

      async output(req, widget, options) {
        return self.render(req, self.template, {
          widget: widget,
          options: options,
          manager: self
        });
      },

      // Perform joins and any other necessary async
      // actions for our type of widget. Note that
      // an array of widgets is handled in a single call
      // as you can usually optimize this.
      //
      // Override this to perform custom joins not
      // specified by your schema, talk to APIs, etc.
      //
      // Also implements the `scene` convenience option
      // for upgrading assets delivered to the browser
      // to the full set of `user` assets.

      async load(req, widgets) {
        if (self.options.scene) {
          req.scene = self.options.scene;
        }
        await self.apos.schemas.join(req, self.schema, widgets, undefined);

        // If this is a virtual widget (a widget being edited or previewed in the
        // editor), any nested areas, etc. inside it haven't already been loaded as
        // part of loading a doc. Do that now by creating a cursor and then feeding
        // it our widgets as if they were docs.

        if (!(widgets.length && widgets[0]._virtual)) {
          return;
        }

        // Get a doc cursor so that we can interpose the widgets as our docs and have the
        // normal things happen after the docs have been "loaded," such as calling loaders
        // of widgets in areas. -Tom and Matt

        // Shut off joins because we already did them and the cursor would try to do them
        // again based on `type`, which isn't really a doc type. -Tom
        const cursor = self.apos.docs.find(req).joins(false);

        // Call .after with our own results
        return cursor.after(widgets);
      },

      // Sanitize the widget. Invoked when the user has edited a widget on the
      // browser side. By default, the `input` object is sanitized via the
      // `convert` method of `@apostrophecms/schemas`, creating a new `output` object
      // so that no information in `input` is blindly trusted.
      //
      // `options` will receive the widget-level options passed in
      // this area, including any `defaultOptions` for the widget type.
      //
      // Returns a new, sanitized widget object.

      async sanitize(req, input, options) {
        if (!input || typeof input !== 'object') {
          // Do not crash
          input = {};
        }
        // Make sure we get default values for contextual fields so
        // `by` doesn't go missing for `@apostrophecms/images-widgets`
        let output = self.apos.schemas.newInstance(self.schema);
        let schema = self.allowedSchema(req);
        output._id = self.apos.launder.id(input._id) || self.apos.utils.generateId();
        await self.apos.schemas.convert(req, schema, input, output);
        output.metaType = 'widget';
        output.type = self.name;
        return output;
      },

      // Return a new schema containing only fields for which the
      // current user has the permission specified by the `permission`
      // property of the schema field, or there is no `permission` property for the field.

      allowedSchema(req) {
        return _.filter(self.schema, function (field) {
          return !field.permission || self.apos.permissions.can(req, field.permission);
        });
      },

      // Remove all properties of a widget that are the results of joins
      // (arrays or objects named with a leading `_`) for use in stuffing the
      // "data" attribute of the widget.
      //
      // If we don't do a good job here we get 1MB+ of markup! So if you override
      // this, play nice. And seriously consider using an AJAX route to fetch
      // the data you need if you only need it under certain circumstances, such as
      // in response to a user click.
      //
      // If the user has editing privileges for the widget, all of the permanent
      // properties of the widget are serialized.
      //
      // If the user does not have editing privileges:
      //
      // If the `playerData` option of the widget's module is set to `false`,
      // only an empty object is supplied. If `playerData` is set to an
      // array, only the named permanent properties are supplied. If `playerData is `true`
      // (the default), all of the permanent properties are supplied.

      filterForDataAttribute(widget) {
        let data = self.apos.utils.clonePermanent(widget, true);
        if (widget._edit || self.options.playerData === true) {
          return data;
        }
        if (self.options.playerData) {
          let result = {};
          _.each(self.options.playerData, function (key) {
            result[key] = data[key];
          });
          return result;
        }
        // For bc; null might confuse older player code
        return {};
      },

      // Filter options passed from the template to the widget before stuffing
      // them into JSON for use by the widget editor. Again, we discard all
      // properties that are the results of joins or otherwise dynamic
      // (arrays or objects named with a leading `_`).
      //
      // If we don't do a good job here we get 1MB+ of markup. So if you override
      // this, play nice. And think about fetching the data you need only when
      // you truly need it, such as via an AJAX request in response to a click.

      filterOptionsForDataAttribute(options) {
        return self.apos.utils.clonePermanent(options, true);
      },

      // Set the options to be passed to the browser-side singleton corresponding
      // to this module. By default they do not depend on `req`, but the availability
      // of that parameter allows subclasses to make distinctions based on permissions,
      // etc.
      //
      // If a `browser` option was configured for the module its properties take precedence
      // over the default values passed on here for `name`, `label`, `action`
      // (the base URL of the module), `schema` and `contextualOnly`.

      getBrowserData(req) {
        if (req.user) {
          const schema = self.allowedSchema(req);
          return {
            name: self.name,
            label: self.label,
            action: self.action,
            schema: schema,
            contextual: self.options.contextual,
            skipInitialModal: self.options.skipInitialModal
          };
        }
      },

      // Implement the command line task that lists all widgets of
      // this type found in the database:
      //
      // `node app your-module-name-here-widgets:list`

      async list(apos, argv) {

        return self.apos.migrations.eachWidget({}, iterator);

        async function iterator(doc, widget, dotPath) {
          if (widget.type === self.name) {
            // console.log is actually appropriate for once
            // because the purpose of this task is to
            // write something to stdout. Should
            // not become an apos.utils.log call. -Tom
            // eslint-disable-next-line no-console
            console.log(doc.slug + ':' + dotPath);
          }
        }
      },

      addSearchTexts(widget, texts) {
        self.apos.schemas.indexFields(self.schema, widget, texts);
      },

      // Return true if this widget should be considered
      // empty, for instance it is a rich text widget
      // with no text or meaningful formatting so far.
      // By default this method returns false, so the
      // presence of any widget of this type means
      // the area containing it is not considered empty.

      isEmpty(widget) {
        return false;
      },

      // override to add CSS classes to the outer wrapper div of the widget.
      getWidgetWrapperClasses(widget) {
        return [];
      },

      // Override to add CSS classes to the div of the widget itself.
      getWidgetClasses(widget) {
        return [];
      }
    };
  }
};