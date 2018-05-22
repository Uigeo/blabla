var express = require('express');
var app = express();
var exphbs  = require('express-handlebars');
var session = require('express-session');
var bodyParser = require('body-parser');
var multer = require('multer');
var upload = multer({dest: 'public/'});
var mysql = require('mysql');

app.use(session({
    secret: '1234DSFs@adf1234!@#$asd',
    resave: false,
    saveUninitialized: true
}));


var server = app.listen(3000, function(){
    console.log('connected :3000');
});

var io = require('socket.io').listen(server);


var conn = mysql.createConnection({
    host     : 'localhost',
    user     : 'root',
    password : '21300267',
    database : 'blabla'
});

var onChat = [];

conn.connect();
app.use(express.static('public'));
app.engine('handlebars', exphbs({defaultLayout: 'main'}));
app.set('view engine', 'handlebars');
app.use(bodyParser.urlencoded({ extended: false }))




app.get('/', function (req, res) {
    
    if(req.session.user_id){
        console.log('authed');
        var sql = `SELECT chatroom.chatroom_id, chatroom_name, hash_tag, (SELECT COUNT(participate.user_id)  FROM participate WHERE participate.chatroom_id = chatroom.chatroom_id AND participate.banish='0') AS person FROM chatroom WHERE chatroom_name NOT IN (SELECT chatroom_name FROM chatroom JOIN participate ON participate.chatroom_id =chatroom.chatroom_id WHERE participate.user_id = '${req.session.user_id}') `;
        conn.query(sql, (err, chatrooms, fields)=>{
        if(err){
            console.log("error___");
            console.error('error connecting: ' + err.stack);
            return;
        } 
        else if (chatrooms.length > 0) {
            console.log(chatrooms);
            var sql = `SELECT  chatroom.chatroom_id, chatroom_name FROM chatroom JOIN participate ON participate.chatroom_id = chatroom.chatroom_id WHERE participate.user_id = ? AND banish = 0`;    
            conn.query(sql, [req.session.user_id], (err, participated, fields)=>{
                if(err){
                    console.error('error connecting: ' + err.stack);
                    return;
                }else if (participated.length > 0){
                    res.render('home', {chatrooms:chatrooms,participated:participated, auth:{user_id:req.session.user_id, user_nickname: req.session.user_nickname, user_profile:req.session.user_profile}} );
                }else{
                    res.render('home', {chatrooms:chatrooms,participated:'No participated Room', auth:{user_id:req.session.user_id, user_nickname: req.session.user_nickname, user_profile:req.session.user_profile}} );
                }
            });
            
        }else{
            console.log("What?");
            res.render('home', {chatrooms:null, auth:{user_id:req.session.user_id, user_nickname: req.session.user_nickname, user_profile:req.session.user_profile}});
        }
    });
    }else{
        res.render('home', {auth:null});
    }
});

app.get('/login', function (req, res) {
    res.render('login');
});

app.get('/signup', function (req, res) {
    res.render('signup');
});

app.get('/newchat', function (req, res) {
    if(req.session.user_id){
        res.render('newchat');
    }
    else{
        res.redirect('/');
    }
});

app.post('/newchat' ,(req, res) => {
    var room_name = req.body.room_name;
    var hashtag = req.body.hash;
    var room_type = req.body.room_type;
    var host = req.session.user_id;
    
    var sql = `INSERT INTO chatroom (chatroom_name, user_id, room_type, hash_tag) VALUES ( ?, ?, ?, ?);` ;
    conn.query(sql, [room_name, host, room_type, hashtag], (err, users, fields)=>{
        if(err){
            console.error('error connecting: ' + err.stack);
            return;
        } else{
            console.log("new-chat");
            res.redirect('/');
        }
    });
});

app.post('/signup', upload.single('profile_img') ,(req, res) => {
    var id = req.body.id;
    var pw = req.body.pw;
    var nick = req.body.nick;
    var url;
    if(req.file){
        url = req.file.filename;
    }else{
        url = "https://www.atabula.com/wp-content/uploads/2017/10/innovore-blabla.jpg";
    }
    
    var sql = `INSERT INTO users (user_id, user_pw, user_nickname, user_profile) VALUES ( ?, ?, ?, ?);` ;
    conn.query(sql, [id, pw, nick, url], (err, users, fields)=>{
        if(err){
            console.error('error connecting: ' + err.stack);
            return;
        } else{
            res.render('login', {signup:'Signup Success'});
        }
    });
});

app.post('/login', function(req, res){
    var id = req.body.id;
    var pw = req.body.pw;
    var sql = `SELECT * FROM users WHERE user_id=?  AND user_pw=?;`;
    conn.query(sql, [id, pw], (err, users, fields)=>{
        if(err){
            console.log("error___");
            console.error('error connecting: ' + err.stack);
            return;
        } 
        else if (users.length > 0) {
            console.log("login successful");
            
            req.session.user_id = users[0].user_id;
            req.session.user_nickname = users[0].user_nickname;
            req.session.user_profile = users[0].user_profile;
            
            res.redirect('/');
        }else{
            console.log("login fail");
            res.render('login', {failed:'Login failed'});
        }
    });
  });

app.get('/logout', function (req, res) {
    delete req.session.user_id;
    delete req.session.user_nickname;
    delete req.session.user_profile;
    res.redirect('/');
});

app.get('/join/:chatroom_id', function (req, res) {
    var chatroom_id = req.params.chatroom_id;
    var sql = `INSERT INTO participate (chatroom_id, user_id, banish, ptime) VALUES ( ?, ?, '0', CURRENT_TIMESTAMP);` 
    conn.query(sql, [chatroom_id, req.session.user_id], (err, participated, fields)=>{
        if(err){
            console.error('error connecting: ' + err.stack);
            return;
        }else{
            res.redirect('/');
        }
    });
});

app.get('/chat/:chatroom_id', (req, res) => {
    var chatroom_id = req.params.chatroom_id;
    var sql = `SELECT user_nickname, user_profile FROM users JOIN participate ON participate.user_id = users.user_id WHERE participate.chatroom_id = ? AND participate.banish=0`;
    conn.query(sql, [chatroom_id], (err, users, fields)=>{
        if(err){
            console.error('error connecting: ' + err.stack);
        }else{
            var sql = `SELECT * FROM msg WHERE datetime > (NOW() - INTERVAL 1 WEEK) AND chatroom_id = ?`;
            conn.query(sql, [chatroom_id], (err, msgs, fields)=>{
                msgs.forEach(msg => {
                    let d =  new Date(msg.datetime).toLocaleTimeString();
                    msg.datetime = d;
                });
                console.log(msgs);
                res.render('chatroom',{chatroom_id:chatroom_id, users:users, nick:req.session.user_nickname, user_id:req.session.user_id, msgs:msgs});
            });
        }
    });
});

app.get('/chatout/:chatroom_id', (req, res) => {
    var chatroom_id = req.params.chatroom_id;
    var sql = `DELETE FROM participate WHERE chatroom_id = ? AND user_id = ?`;
    conn.query(sql, [chatroom_id , req.session.user_id], (err, users, fields)=>{
        if(err){
            console.error('error connecting: ' + err.stack);
        }else{
            res.redirect('/');
        }
    });
});


io.on('connection', function(socket){
        
    socket.on(`chat`, function(m){
      io.emit(m.id, m.msg);
      var sql = `INSERT INTO msg (content, user_id, read_count, datetime, chatroom_id) VALUES( ? , ? ,'1', NOW(), ?)`;
      conn.query(sql, [m.msg , m.user, m.id], (err, users, fields)=>{
          if(err){
              console.error('error connecting: ' + err.stack);
          }else{
              console.log('save');
          }
      });
    });


    socket.on('disconnect', function () {
        console.log('disconnect!!!');
        io.emit('user disconnected');
      });
});

app.get('/mypage', (req, res) => {

    var sql = `Select * FROM users WHERE user_id = ?`;
    conn.query(sql, [req.session.user_id], (err, user, fields)=>{
        if(err){
            console.error('error connecting: ' + err.stack);
        }else{
            res.render('mypage', {user:user[0]});
        }
    });
});

app.get('/delete/:user_id', (req, res) => {
    if(req.session.user_id === req.params.user_id){
        let id = req.params.user_id;
        var sql = `
        DELETE FROM participate WHERE user_id = ?;
        DELETE FROM msg WHERE user_id = ?;  
        DELETE FROM users WHERE user_id = ?;   
        `;
        conn.query(sql, [id,id,id], (err, user, fields)=>{
            if(err){
                console.error('error connecting: ' + err.stack);
            }else{
                req.session.destroy();
                res.redirect('/');
            }
        });
    }
});


app.get('/toomuch/:chatroom_id', (req,res)=>{
    var chatroom_id = req.params.chatroom_id;
    var sql = `SELECT * FROM users 
            WHERE (SELECT COUNT(msg.msg_id) AS nmsg FROM msg 
            WHERE msg.user_id = users.user_id AND datetime > (NOW() - INTERVAL 1 WEEK) AND msg.chatroom_id = ${chatroom_id})
            = (SELECT MAX( (SELECT COUNT(msg.msg_id) AS nmsg FROM msg WHERE msg.user_id =users.user_id AND datetime > 
            (NOW() - INTERVAL 1 WEEK) AND msg.chatroom_id = ${chatroom_id})) FROM users)`;

    conn.query(sql, (err, user, fields)=>{
        if(err){
            console.error('error connecting: ' + err.stack);
        }else{
            res.render('toomuch', {user:user[0]});
        }
    });
})

app.get('/search/notin/:keyword', (req,res)=>{
    var keyword = req.params.keyword;
    var sql
     = `SELECT chatroom_id ,chatroom_name, hash_tag, (SELECT COUNT(participate.user_id)  FROM participate WHERE participate.chatroom_id = chatroom.chatroom_id AND participate.banish ='0') AS person FROM chatroom WHERE chatroom_name LIKE '%${keyword}%' OR hash_tag LIKE '%${keyword}%'`;
    console.log(keyword);
    conn.query(sql, (err, chatrooms, fields)=>{
        if(err){
            console.error('error connecting: ' + err.stack);
        }else{
            return res.render('notin', {chatrooms:chatrooms});
        }
    });
})

app.get('/search/in/:keyword', (req,res)=>{
    var keyword = req.params.keyword;
    var sql
     = `SELECT chatroom_id ,chatroom_name, hash_tag, (SELECT COUNT(participate.user_id) AS person FROM participate WHERE participate.chatroom_id = chatroom.chatroom_id AND participate.banish ='0') FROM chatroom WHERE chatroom_name LIKE '%${keyword}%' OR hash_tag LIKE '%${keyword}%'`;

    conn.query(sql, (err, chatrooms, fields)=>{
        if(err){
            console.error('error connecting: ' + err.stack);
        }else{
            res.render('in', {chatrooms});
        }
    });
})



// var login = require('./login')(app);
// app.use('/login', login);

// var main = require('./main')(app);
// app.use('/main', main);