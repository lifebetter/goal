/*jshint node:true */
"use strict";
var goalModel  = require('../models/goal.js'),
    modelUtil  = require('../util/modelUtil.js'),
    marked     = require('marked'),
    authUtil   = require('../util/authUtil.js'),
    Model      = goalModel.getModel(),
    activeStatusWhere = {$nin: goalModel.getArchivedStatuses()},
    archivedStatusWhere = {$in: goalModel.getArchivedStatuses()};

var queryGoalsByStatusAndDue = function (req, res, statusWhere, dueDateWhere) {
    var where = {
        userId: req.user._id
    };
    if (null !== dueDateWhere && undefined !== dueDateWhere) {
        where.dueDate = dueDateWhere;
    }
    if (null !== statusWhere && undefined !== statusWhere) {
        where.status = statusWhere;
    }
    return Model.find(where, function (err, goals) {
        return modelUtil.constructResponse(res, err, {'goals' : goals});
    });
};

exports.getByDueDateRange = function (req, res) {
    var start = req.params.dueDateStart, stop = req.params.dueDateStop;
    var dueDateWhere = {};
    if (start !== '0') {
        dueDateWhere.$gt = new Date().setTime(start);
    }
    if (stop !== '0') {
        dueDateWhere.$lte = new Date().setTime(stop);
    }
    return queryGoalsByStatusAndDue(req, res, activeStatusWhere, dueDateWhere);
};

exports.list = function (req, res) {
    return queryGoalsByStatusAndDue(req, res, activeStatusWhere);
};

exports.listArchived = function (req, res) {
    return queryGoalsByStatusAndDue(req, res, archivedStatusWhere);
};

exports.getUpcomingOne = function (req, res) {
    var where = {
        userId: req.user._id
    };
    where.dueDate = {$gt : new Date()};
    where.status = activeStatusWhere;
    console.dir(where);
    return Model.find(where)
        .limit(1)
        .sort('dueDate')
        .exec(function (err, goal) {
            return modelUtil.constructResponse(res, err, {'goal' : goal});
        });
};

exports.create = function (req, res) {
    var goal = new Model({
        title: req.body.goal.title,
        description: req.body.goal.description === undefined ? '' : req.body.goal.description,
        type: req.body.goal.type,
        status: req.body.goal.status,
        dueDate: req.body.goal.dueDate,
        createDate: req.body.goal.createDate,
        userId: req.body.goal.userId
    });
    if (req.body.goal._id) {
        goal._id = req.body.goal._id;
    }
    return modelUtil.saveToDb(goal, res);
};

exports.get = function (req, res) {
    return Model.findById(req.params.id, function (err, goal) {
        if (goal !== undefined && goal !== null) {
            var i, comments = goal.comments;
            for (i = 0; i < comments.length; i++) {
                comments[i].content = marked(comments[i].content);
            }
        }
        return modelUtil.constructResponse(res, err, {'goal' : goal});
    });
};

exports.update = function (req, res) {
    var goal = {
            title: req.body.goal.title,
            description: req.body.goal.description === undefined ? '' : req.body.goal.description,
            type: req.body.goal.type,
            status: req.body.goal.status
        },
        query   = {'_id' : req.params.id},
        options = {'new' : true};
    if (req.body.goal.dueDate !== undefined) {
        goal.dueDate = req.body.goal.dueDate;
    }
    return Model.findOneAndUpdate(query, goal, options, function (err, data) {
        return modelUtil.constructResponse(res, err, {'goal' : data});
    });
};

exports.remove = function (req, res) {
    return Model.findById(req.params.id, function (err, goal) {
        return goal.remove(function (err) {
            return modelUtil.constructResponse(res, err, {'goal' : goal});
        });
    });
};

exports.createNote = function (req, res) {
    return Model.findById(req.params.id, function (err, goal) {
        goal.comments.push({
            'content' : req.body.comment.content,
            'date'    : req.body.comment.date
        });
        return modelUtil.saveToDb(goal, res);
    });
};

exports.removeNote = function (req, res) {
    return Model.findById(req.params.id, function (err, goal) {
        if (goal) {
            goal.comments.pull({
                '_id' : req.params.noteId
            });
        }
        return modelUtil.saveToDb(goal, res);
    });
};

exports.registerMe = function (app) {
    var checkLoggedIn = authUtil.isLoggedIn;
    app.get('/api/goals', checkLoggedIn, this.list);
    app.get('/api/goals/archived', checkLoggedIn, this.listArchived);
    app.get('/api/goals/upcoming', checkLoggedIn, this.getUpcomingOne);
    app.get('/api/goals/:dueDateStart/:dueDateStop', checkLoggedIn, this.getByDueDateRange);
    app.post('/api/goals', checkLoggedIn, this.create);
    app.get('/api/goals/:id', checkLoggedIn, this.get);
    app.put('/api/goals/:id', checkLoggedIn, this.update);
    app.delete('/api/goals/:id', checkLoggedIn, this.remove);
    app.post('/api/goal/notes/:id', checkLoggedIn, this.createNote);
    app.delete('/api/goal/notes/:id/:noteId', checkLoggedIn, this.removeNote);
};
