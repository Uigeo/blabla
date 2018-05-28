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
    database : 'blabla',
    multipleStatements : true
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
        else if (chatrooms.length > -1) {
           
            var sql = `
                START TRANSACTION;
                CREATE VIEW userin AS SELECT chatroom.chatroom_id ,chatroom.chatroom_name, chatroom.hash_tag FROM chatroom JOIN participate ON participate.chatroom_id =chatroom.chatroom_id WHERE participate.user_id = ? AND banish = 0;
                SELECT userin.chatroom_id, userin.chatroom_name, userin.hash_tag, msg.content FROM userin JOIN msg ON userin.chatroom_id = msg.chatroom_id WHERE msg.datetime = (SELECT MAX(datetime) FROM msg WHERE msg.chatroom_id = userin.chatroom_id);
                COMMIT;
            `;    
            conn.query(sql, [req.session.user_id], (err, participated, fields)=>{
                if(err){
                    console.error('error connecting: ' + err.stack);
                    return;
                }else if (participated.length > 0){
                    
                    conn.query('DROP VIEW userin;', (eer, result, fields)=>{
                        if(err)console.error('error connecting: ' + err.stack);
                    });
                    res.render('home', {chatrooms:chatrooms,participated:participated[2], auth:{user_id:req.session.user_id, user_nickname: req.session.user_nickname, user_profile:req.session.user_profile}} );
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
    
    var sql = `
        START TRANSACTION;
        INSERT INTO chatroom (chatroom_name, user_id, room_type, hash_tag) VALUES ( ?, ?, ?, ?);
        SELECT @A:=chatroom_id FROM chatroom WHERE chatroom_name = ?;
        INSERT INTO participate (chatroom_id, user_id, banish, ptime)VALUES(@A,?,'0',NOW());
        INSERT INTO msg (content, user_id, read_count, datetime, chatroom_id) VALUES('Chatroom Created',?,'1',NOW(),@A);
        COMMIT;
        ` ;
    conn.query(sql, [room_name, host, room_type, hashtag, room_name, req.session.user_id, req.session.user_id], (err, users, fields)=>{
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
    if(req.session.user_id){
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
    }else{
        res.redirect('/');
    }


});

app.get('/chat/:chatroom_id', (req, res) => {
    if(req.session.user_id){
        var chatroom_id = req.params.chatroom_id;
        req.session.cur_chatroom = chatroom_id;

        var sql = `UPDATE participate SET ptime = now() WHERE chatroom_id = ? AND user_id = ?`;
        conn.query(sql, [chatroom_id, req.session.user_id], (err, result, fields)=>{
            if(err){
                console.error('error connecting: ' + err.stack);
            }
            console.log("Work");
        });

        var sql = `SELECT msg.content,msg.datetime, users.user_nickname,(SELECT COUNT(participate.user_id) AS person FROM participate WHERE participate.chatroom_id = ? AND participate.ptime >msg.datetime) AS mcount FROM msg JOIN users ON users.user_id =msg.user_id WHERE msg.datetime > (NOW() - INTERVAL 1 WEEK) AND msg.chatroom_id = ? ORDER BY msg.datetime`;
        conn.query(sql, [chatroom_id, chatroom_id], (err, msgs, fields)=>{
            if(err){
                console.error('error connecting: ' + err.stack);
            }else{
                msgs.forEach(msg => {
                    let d =  new Date(msg.datetime).toLocaleTimeString();
                    msg.datetime = d;
                });
                res.render('chatroom',{chatroom_id:chatroom_id, nick:req.session.user_nickname, user_id:req.session.user_id, msgs:msgs});
            }
        });
    }
    else{
        res.redirect('/');
    }
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
      
      var sql = `INSERT INTO msg (content, user_id, read_count, datetime, chatroom_id) VALUES( ? , ? ,'1', NOW(), ?)`;
      conn.query(sql, [m.msg , m.user, m.id], (err, msg, fields)=>{
          if(err){
              console.error('error connecting: ' + err.stack);
          }else{
                m.msg_id = msg.insertId;
                io.emit(m.id, m);
              console.log(m);
          }
      });
    });


    socket.on('disconnect', function () {
       
        var sql = `UPDATE participate SET ptime = now() WHERE chatroom_id = ? AND user_id = ?`;
        console.log('disconnect');
        io.emit('user disconnected');
      });
});

app.get('/mypage', (req, res) => {
    if(req.session.user_id){
        var sql = `Select * FROM users WHERE user_id = ?`;
        conn.query(sql, [req.session.user_id], (err, user, fields)=>{
            if(err){
                console.error('error connecting: ' + err.stack);
            }else{
                var sql = `SELECT chatroom_id, chatroom_name, room_type, hash_tag FROM chatroom WHERE user_id = ?`;
                conn.query(sql, [req.session.user_id], (err, chatrooms, fields)=>{
                    if(err){
                        console.error('error connecting: ' + err.stack);
                    }else{
                        res.render('mypage', {user:user[0] ,myroom:chatrooms });
                    }
                });
            }
        });
    }else{
        res.redirect('/');
    }

});

app.get('/delete/:user_id', (req, res) => {
    if(req.session.user_id === req.params.user_id){
        let id = req.params.user_id;
        var sql = `
        SET FOREIGN_KEY_CHECKS = 0;
        DELETE FROM participate WHERE user_id = ?;
        DELETE FROM msg WHERE user_id = ?;  
        DELETE FROM users WHERE user_id = ?;
        SET FOREIGN_KEY_CHECKS = 1;   
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
    
    conn.query(sql, (err, chatrooms, fields)=>{
        if(err){
            console.error('error connecting: ' + err.stack);
        }else{
            return res.render('notin', {chatrooms:chatrooms});
        }
    });
})


app.get('/notice/:chatroom_id', (req,res) => {
    var chatroom_id = req.params.chatroom_id;
    var sql = `SELECT chatroom.chatroom_id, content, datetime FROM chatroom JOIN msg ON chatroom.chatroom_id = ? AND msg.msg_id = chatroom.room_notice`;
    conn.query(sql,[chatroom_id], (err, msg, fields)=>{
        if(err){
            console.error('error connecting: ' + err.stack);
        }else{
            try {
                res.send(` <h1> ${msg[0].content}</h1> `);
            } catch (error) {
                res.send("No Notice");
            }

        }
    })

})

app.get('/setnotice/:chatroom_id/:msg_id', (req,res) => {
    var chatroom_id = req.params.chatroom_id;
    var msg_id = req.params.msg_id;
    console.log(chatroom_id);
    console.log(msg_id);
    var sql = `UPDATE chatroom SET room_notice = ? WHERE chatroom_id = ?`;
    conn.query(sql,[msg_id, chatroom_id], (err, msg, fields)=>{
        if(err){
            console.error('error connecting: ' + err.stack);
        }
    })
})

app.get(`/rmroom/:chatroom_id`, (req, res)=> {
    var chatroom_id = req.params.chatroom_id;
    var sql = `
    SET FOREIGN_KEY_CHECKS = 0;
    DELETE FROM msg WHERE chatroom_id = ?;
    DELETE FROM participate WHERE chatroom_id = ?; 
    DELETE FROM chatroom WHERE chatroom_id = ?;
    SET FOREIGN_KEY_CHECKS = 0;
    `;
    conn.query(sql,[chatroom_id, chatroom_id, chatroom_id], (err, msg, fields)=>{
        if(err){
            console.error('error connecting: ' + err.stack);
        }else{
            res.redirect('/');
        }
    });
    console.log('Deleted');
})

app.get('/banlist/:chatroom_id', (req, res)=>{
    var chatroom_id = req.params.chatroom_id;
    var user_id = req.session.user_id;
    var sql = `SELECT * FROM chatroom WHERE chatroom_id = ? AND user_id = ?`;
    conn.query( sql, [chatroom_id, user_id], (err, result, fields)=>{
        if(err) {
            console.error('error connecting: ' + err.stack);
        }else{
            if(result.length > 0){
                sql = `SELECT * FROM users JOIN participate ON participate.user_id = users.user_id WHERE participate.chatroom_id = ? AND participate.banish=0`;
                conn.query(sql, [chatroom_id], (err, users, fields)=>{
                    if(err){
                        console.error('error connecting: ' + err.stack);
                    }else{
                        res.render('banlist', {users: users, chatroom_id:chatroom_id});
                    }
                });
            }else{
                res.send("You are not host!!");
            }
        }
    });
})

app.get('/ban/:chatroom_id/:user_id', (req,res)=>{
    var chatroom_id = req.params.chatroom_id;
    var user_id = req.params.user_id;
    var sql = `UPDATE participate SET banish = 1 WHERE chatroom_id = ? AND user_id = ?`;
    conn.query(sql, [chatroom_id, user_id], (err, result, fields)=>{
        if(err){
            console.error('error connecting: ' + err.stack);
        }else{
            console.log("Ban!!");
            io.emit('ban', user_id);
        }
    });
})

app.get('/userlist/:chatroom_id', (req,res)=>{
    var chatroom_id = req.params.chatroom_id;
    var sql = `SELECT users.user_id ,user_nickname, user_profile FROM users JOIN participate ON participate.user_id = users.user_id WHERE participate.chatroom_id = ? AND participate.banish=0`;
    conn.query(sql, [chatroom_id], (err, users, fields)=>{
        if(err){
            console.error('error connecting: ' + err.stack);
        }else{
            res.render('users', {users:users});
        }
    });
});

app.get('/hotplace', (req,res)=>{
    
    var sql = `SELECT chatroom_id ,chatroom_name, hash_tag FROM chatroom WHERE (SELECT COUNT(msg.msg_id) AS nmsg FROM msg WHERE msg.chatroom_id = chatroom.chatroom_id AND datetime > (NOW() - INTERVAL 1 WEEK)) = (SELECT MAX( (SELECT COUNT(msg.msg_id) AS nmsg FROM msg WHERE msg.chatroom_id = chatroom.chatroom_id AND datetime > (NOW() - INTERVAL 1 WEEK))) FROM chatroom)`;
    conn.query(sql, (err, chatroom, fields)=>{
        if(err){
            console.error('error connecting: ' + err.stack);
        }else{
            res.render('hotplace', {chatroom:chatroom[0]});
        }
    });
});
