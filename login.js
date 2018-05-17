module.exports = function(app){
    var express = require('express');
    var route = express.Router();
    route.get('/', function(req, res){
      res.render('login');
    });
    return route;
  };