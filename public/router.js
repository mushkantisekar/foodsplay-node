//an observable that retrieves its value when first bound
ko.onDemandObservable = function(callback, target) {
    var _value = ko.observable();  //private observable

    var result = ko.computed({
        read: function() {
            //if it has not been loaded, execute the supplied function
            if (!result.loaded()) {
                callback.call(target);
            }
            //always return the current value
            return _value();
        },
        write: function(newValue) {
            //indicate that the value is now loaded and set it
            result.loaded(true);
            _value(newValue);
        },
        deferEvaluation: true  //do not evaluate immediately when created
    });

    //expose the current state, which can be bound against
    result.loaded = ko.observable();
    //load it again
    result.refresh = function() {
        result.loaded(false);
    };

    return result;
};

var ActionFactory = {
    registerDelAction: function(app, resource) {
        app.del("#/restaurants/:id/" + resource + "/:mid", function(context) {
            var self = this;
            console.log(this.path);
            $.ajax({
                url: this.path.substring(2),
                type: 'DELETE',
                headers: {
                    'x-csrf-token': self.params['csrf']
                }
            }).always(function() {
                console.log('delete done');
                app.runRoute('get', "#/restaurants/" + self.params['id'] + "/" + resource);

            }).fail(function() {
                console.log('delete failed');
            });
        });
    }
};

$(function() {
    window.currentModel = null;

    window.app = $.sammy('#app-content', function() {
        var app = this;

        this.get("#/", function(context) {
            console.log('main page');
            var home_url = '#/';
            switch(CONFIG.user.kind) {
            case 1: /* normal */
                home_url = '#/publicusers/' + CONFIG.user._id;
                $('#js-home').attr('href', home_url);
                break;

            case 2: /* restaurant */
                if (!CONFIG.user.restaurant) {
                    home_url = '#/businessusers/' + CONFIG.user._id;
                } else {
                    home_url = '#/restaurants/' + CONFIG.user.restaurant;
                }
                $('#js-home').attr('href', home_url);
                break;

            default: /* admin */
                //TODO: get some statistics for admin
                home_url = '#/admin';
                break;
            }

            app.setLocation(home_url);
        });


        this.get("#/admin", function(context) {
            $.getJSON(this.path.substring(2), function(data) {
                app.$element().html( jade.compile($('#adminuser_tmpl').html())() );
                window.currentModel = new AdminViewModel(data);
                ko.applyBindings(window.currentModel, app.$element()[0]);
            });
        });

        this.get("#/businessusers", function(context) {
            $.getJSON(this.path.substring(2), function(data) {
                app.$element().html( jade.compile($('#businessusers_tmpl').html())() );
                window.currentModel = new UsersViewModel(data);
                ko.applyBindings(window.currentModel, app.$element()[0]);
            });
        });

        this.get("#/businessusers/:bid", function(context) {
            $.getJSON(this.path.substring(2), function(data) {
                app.$element().html( jade.compile($('#businessuser_tmpl').html())() );
                window.currentModel = new UserViewModel(data);
                ko.applyBindings(window.currentModel, app.$element()[0]);
            });
        });


        this.get("#/restaurants", function(context) {
            $.getJSON(this.path.substring(2), function(data) {
                data.forEach(function(ob) {
                    ob.url = ko.computed(function() {
                        return "#/restaurants/" + ob._id;
                    });
                });

                app.$element().html( jade.compile($('#restaurants_tmpl').html())() );
                window.currentModel = new RestaurantsViewModel(data);
                ko.applyBindings(window.currentModel, app.$element()[0]);
            });
        });

        this.get("#/restaurants/new", function(context) {
            app.$element().html( jade.compile($('#restaurants_new_tmpl').html())() );
            window.currentModel.setupValidation();
            ko.applyBindings(window.currentModel, app.$element()[0]);
        });


        this.get("#/restaurants/:id", function(context) {
            $.getJSON(this.path.substring(2), function(data) {
                app.$element().html( jade.compile($('#restaurant_tmpl').html())() );
                window.currentModel = new RestaurantViewModel(data);
                ko.applyBindings(window.currentModel, app.$element()[0]);
            });
        });

        this.get("#/restaurants/:id/edit", function(context) {
            app.$element().html( jade.compile($('#restaurants_edit_tmpl').html())() );
            window.currentModel.setupValidation();
            ko.applyBindings(window.currentModel, app.$element()[0]);
        });


        this.get("#/restaurants/:id/foods", function(context) {
            var self = this,
                url = this.path.substring(2),
                metas_url = '/restaurants/' + self.params['id'] + '/metas';

            $.getJSON(url, function(data) {
                $.getJSON(metas_url, function(metas) {
                    app.$element().html( jade.compile($('#foods_tmpl').html())() );
                    window.currentModel = new FoodsViewModel(self.params['id'], metas, data);
                    ko.applyBindings(window.currentModel, app.$element()[0]);
                });
            });
        });

        this.post("#/restaurants/:id/foods", function(context) {
            console.log('post new food', this.params);

            $.ajax({
                type: 'POST',
                url: this.path.substring(2),
                data: {
                    _csrf: this.params['_csrf'],
                    restaurantid: this.params['id'],
                    food: JSON.parse(ko.toJSON(window.currentModel.newFood()))
                },
                dataType: 'json',
                success: function(data) {
                    console.log('post done', data);
                }
            });
        });

        this.get("#/restaurants/:id/foods/:fid/edit", function(context) {
            app.$element().html( jade.compile($('#foods_edit_tmpl').html())() );
            window.currentModel.setupValidation();
            ko.applyBindings(window.currentModel, app.$element()[0]);
        });

        this.get("#/restaurants/:id/foods/new", function(context) {
            app.$element().html( jade.compile($('#foods_new_tmpl').html())() );
            window.currentModel.setupValidation();
            ko.applyBindings(window.currentModel, app.$element()[0]);
        });

        ActionFactory.registerDelAction(this, 'foods');

        this.get("#/restaurants/:id/metas", function(context) {
            var self = this,
                url = this.path.substring(2);

            $.getJSON(url, function(data) {
                app.$element().html( jade.compile($('#metas_tmpl').html())() );
                window.currentModel = new MetasViewModel(self.params['id'], data);
                ko.applyBindings(window.currentModel, app.$element()[0]);
            });
        });



        this.get("#/restaurants/:id/orders", function(context) {
            var self = this;

            $.getJSON(this.path.substring(2), function(data) {
                app.$element().html( jade.compile($('#orders_tmpl').html())() );
                window.currentModel = new OrdersViewModel(self.params['id'], data);
                ko.applyBindings(window.currentModel, app.$element()[0]);
            });
        });

        this.get("#/restaurants/:id/orders/:oid", function(context) {
            var self = this;

            $.getJSON(this.path.substring(2), function(data) {
                app.$element().html( jade.compile($('#order_tmpl').html())() );
                window.currentModel = new OrderViewModel(self.params['id'], data);
                ko.applyBindings(window.currentModel, app.$element()[0]);
            });
        });


        this.get("#/restaurants/:id/members", function(context) {
            var self = this;

            $.getJSON(this.path.substring(2), function(data) {
                app.$element().html( jade.compile($('#members_tmpl').html())() );
                window.currentModel = new MembersViewModel(self.params['id'], data);
                ko.applyBindings(window.currentModel, app.$element()[0]);
            });
        });

        ActionFactory.registerDelAction(this, 'members');

        this.get("#/restaurants/:id/members/new", function(context) {
            app.$element().html( jade.compile($('#members_new_tmpl').html())() );
            window.currentModel.setupValidation();
            ko.applyBindings(window.currentModel, app.$element()[0]);
        });


        // ---- EMPLOYEES
        this.get("#/restaurants/:id/employees", function(context) {
            var self = this;

            $.getJSON(this.path.substring(2), function(data) {
                app.$element().html( jade.compile($('#employees_tmpl').html())() );

                window.currentModel = new EmployeesViewModel(self.params['id'], data);
                window.currentModel.setupValidation();
                ko.applyBindings(window.currentModel, app.$element()[0]);
            });
        });

        ActionFactory.registerDelAction(this, 'employees');

        // this.post("#/restaurants/:id/employees", function(context) {
        //     var model = window.currentModel,
        //         self = this,
        //         data = {};

        //     if (model.validate()) {
        //         Object.keys(this.params).forEach(function(k) {
        //             data[k] = self.params[k];
        //         });

        //         console.log('post new employee', data);
        //         $.ajax({
        //             url: this.path.substring(2),
        //             type: 'post',
        //             data: data,
        //             headers: {
        //                 'x-csrf-token': data['_csrf']
        //             }
        //         }).always(function(data) {
        //             console.log('post done', data);
        //             model.newEmployee(new Employee);

        //         }).fail(function() {
        //             console.log('post failed');
        //         });
        //     }
        //     return false;
        // });


        //----- Clients
        this.get("#/restaurants/:id/clients", function(context) {
            var self = this;

            $.getJSON(this.path.substring(2), function(data) {
                app.$element().html( jade.compile($('#clients_tmpl').html())() );

                window.currentModel = new ClientsViewModel(self.params.id, data);
                window.currentModel.setupValidation();
                ko.applyBindings(window.currentModel, app.$element()[0]);
            });
        });

        ActionFactory.registerDelAction(this, 'clients');
    });


    init_url = '#/';
    window.app.run(init_url);
});
