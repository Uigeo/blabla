var express = require('express');
var exphbs  = require('express-handlebars');
var bodyParser = require('body-parser');
var multer = require('multer');
var upload = multer({dest: 'public/'});
var mysql = require('mysql');


var app = express();

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

var auth = {
    user_id: null,
    user_nickname: null,
    user_profile: null,
}


app.get('/', function (req, res) {
    
    if(auth.user_id){
        console.log('authed');
        var sql = `SELECT * FROM chatroom;`;
        conn.query(sql, (err, chatrooms, fields)=>{
        if(err){
            console.log("error___");
            console.error('error connecting: ' + err.stack);
            return;
        } 
        else if (chatrooms.length > 0) {
            console.log(chatrooms);
            res.render('home', {chatrooms:chatrooms, auth:auth} );
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

app.post('/signup', upload.single('profile_img') ,(req, res) => {
    console.log("post file");
    var id = req.body.id;
    var pw = req.body.pw;
    var nick = req.body.nick;
    console.log(req.file);
    var url = req.file.filename;
    
    var sql = `INSERT INTO users (user_id, user_pw, user_nickname, user_profile) VALUES ( ?, ?, ?, ?);` ;
    conn.query(sql, [id, pw, nick, url], (err, users, fields)=>{
        if(err){
            console.error('error connecting: ' + err.stack);
            return;
        } else{
            console.log("What?");
            res.render('login', {signup:'Signup Success'});
        }
    });
});

app.post('/login_process', function(req, res){
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
            console.log("Working");
            auth = {
                user_id : users[0].user_id,
                user_nickname : users[0].user_nickname,
                user_profile : users[0].user_profile
            }
            res.render('loged', {auth:auth} );
        }else{
            console.log("What?");
            res.render('login', {failed:'Login failed'});
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