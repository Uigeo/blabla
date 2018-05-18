var express = require('express');
var exphbs  = require('express-handlebars');
var bodyParser = require('body-parser');
var multer = require('multer');
var upload = multer({dest: 'public/'});
var mysql = require('mysql');

var app = express();

var auth = {
    user_id: null,
    user_nickname: null,
    user_profile: null,
}

var conn = mysql.createConnection({
    host     : 'localhost',
    user     : 'root',
    password : '21300267',
    database : 'blabla'
  });
conn.connect();
app.use(express.static('public'));
app.engine('handlebars', exphbs({defaultLayout: 'main'}));
app.set('view engine', 'handlebars');
app.use(bodyParser.urlencoded({ extended: false }))




app.get('/', function (req, res) {
    
    if(auth.user_id){
        console.log('authed');
        var sql = `SELECT chatroom_id ,chatroom_name, hash_tag, (SELECT COUNT(participate.user_id)  FROM participate WHERE participate.chatroom_id = chatroom.chatroom_id AND participate.banish = 0) AS person FROM chatroom`;
        conn.query(sql, (err, chatrooms, fields)=>{
        if(err){
            console.log("error___");
            console.error('error connecting: ' + err.stack);
            return;
        } 
        else if (chatrooms.length > 0) {
            var sql = `SELECT chatroom_name FROM chatroom JOIN participate ON participate.chatroom_id = chatroom.chatroom_id WHERE participate.user_id = ? AND banish = 0`;    
            conn.query(sql, [auth.user_id], (err, participated, fields)=>{
                if(err){
                    console.error('error connecting: ' + err.stack);
                    return;
                }else if (participated.length > 0){
                    res.render('home', {chatrooms:chatrooms,participated:participated, auth:auth} );
                }else{
                    res.render('home', {chatrooms:chatrooms,participated:'No participated Room', auth:auth} );
                }
            });
            
        }else{
            console.log("What?");
            res.render('home', {chatrooms:null, auth:auth});
        }
    });
    }else{
        res.render('home', {auth:auth});
    }
});

app.get('/login', function (req, res) {
    res.render('login');
});

app.get('/signup', function (req, res) {
    res.render('signup');
});

app.get('/newchat', function (req, res) {
    if(auth.user_id){
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
    var host = auth.user_id;
    
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
    var url = req.file.filename;
    
    var sql = `INSERT INTO users (user_id, user_pw, user_nickname, user_profile) VALUES ( ?, ?, ?, ?);` ;
    conn.query(sql, [id, pw, nick, url], (err, users, fields)=>{
        if(err){
            console.error('error connecting: ' + err.stack);
            return;
        } else{
            console.log(users);
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
            auth = {
                user_id : users[0].user_id,
                user_nickname : users[0].user_nickname,
                user_profile : users[0].user_profile
            }
            res.render('loged', {auth:auth} );
        }else{
            console.log("login fail");
            res.render('login', {failed:'Login failed'});
        }
    });
  });

app.get('/logout', function (req, res) {
    auth = {
        user_id: null,
        user_nickname: null,
        user_profile: null,
    }
    res.redirect('/');
});

app.get('/join/:chatroom_id', function (req, res) {
    var chatroom_id = req.params.chatroom_id;
    var sql = `INSERT INTO participate (chatroom_id, user_id, banish, ptime) VALUES ( ?, ?, '0', CURRENT_TIMESTAMP);` 
    conn.query(sql, [chatroom_id, auth.user_id], (err, participated, fields)=>{
        if(err){
            console.error('error connecting: ' + err.stack);
            return;
        }else{
            console.log(participated);
            res.redirect('/');
        }
    });
});


app.listen(3000, function(){
  console.log('connected :3000');
});


// var login = require('./login')(app);
// app.use('/login', login);

// var main = require('./main')(app);
// app.use('/main', main);