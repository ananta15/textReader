const express = require('express');
const ejs=require('ejs')
const bcrypt=require('bcrypt')
const upload = require('express-fileupload')
const fs = require('fs');
const pdfparse = require('pdf-parse');
const { pool }=require('./dbConfig')
const PORT=process.env.PORT || 5000;
const flash=require('express-flash');
const session=require('express-session');
const passport=require('passport');
const path = require('path');
const app = express();


const initializePassport=require("./passportConfig");
initializePassport(passport);


app.use('/public', express.static('public'));
// app.use(express.static(path.join(__dirname,'public')));
app.use(upload());
app.set('view engine','ejs');
app.use(express.urlencoded({extended: false})); 
app.use(session({
    secret:"secret",
    resave: false,
    saveUninitialized:false
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());


app.get("/",(req,res)=>{
    res.render('pages/index');
})
app.get("/about",(req,res)=>{
    res.render('pages/about');
})
app.get("/contact",(req,res)=>{
    res.render('pages/contact');
})
app.get("/login",checkAuthenticated,(req,res)=>{
    res.render('pages/login');
})
app.get("/register",checkAuthenticated,(req,res)=>{
    res.render('pages/register');
})
app.get('/profile',checkNotAuthenticated,(req,res)=>{
    res.render('pages/profile');
    // res.sendFile(__dirname+"profile.html")
});
app.get("/logout",(req,res)=>{
    req.logOut();
    req.flash("success_msg","You are successfully logout");
    res.redirect("/login");
});

app.post('/profile', (req, res) => {
    if (req.files) {
        console.log(req.files)
        var file = req.files.file
        var filename = file.name
        console.log("filename:")
        console.log(filename)

        file.mv('./uploads/' + filename, function (err) {
            if (err) {
                res.send(err)
            } else {
                //res.send("file uploaded")
                const pdffile = fs.readFileSync('./uploads/' + filename);
                pdfparse(pdffile).then(function (data) {
                    console.log("No. of pages: " + data.numpages);
                    console.log(data.info);
                    console.log("text:"+data.text);
                    let msg=data.text;
                    let errors=[];
                    errors.push({message:msg});
                    res.render("pages/profile",{errors});
                    
                    // msg.push(data.text);
                    // res.render("",{user:"hi"})
                })
            }
        })
    }
});

app.post('/register',async(req,res)=>{
    let {name,email, password,password2}=req.body;
    console.log(name,email,password,password2);

    let errors=[];

    if(!name || !email || !password2 || !password){
        errors.push({message:"Enter full details"})
    }
    if(password.length<5){
        errors.push({message:"Enter password with atleast 6 characters"})
    }
    if(password != password2){
        errors.push({message:"Password do not match"})
    }
    if(errors.length>0){
        res.render('pages/register',{errors});
    }
    else{
        let hashedPassword=await bcrypt.hash(password,10);
        console.log(hashedPassword);

        pool.query(
            `SELECT * FROM users
            WHERE email=$1`,
            [email],
            (err,results)=>{
                if(err){
                    throw err;
                }
                console.log(results.rows);
                //let error=[];
                if(results.rows.length>0){
                    errors.push({message:"Email already registered"});
                    res.render("pages/register",{errors});
                }
                else{
                    var joined=new Date();
                    pool.query(
                        `INSERT INTO users(name,email,password,joined)
                          VALUES ($1,$2,$3,$4)
                            RETURNING id,password`,
                            [name,email,hashedPassword,joined],
                            (err,results)=>{
                                if(err){
                                    throw err;
                                }
                                console.log(results.rows);
                                req.flash("success_msg","You are now registered")
                                res.redirect("/login");
                            }
                    )
                }
            }
        )
    }

});


app.post(
    "/login",
    passport.authenticate("local",{
        successRedirect:"/profile",
        failureRedirect:"/login",
        failureFlash:true
    })

);



function checkAuthenticated(req,res,next){
    if(req.isAuthenticated()){
        return res.redirect("/profile");
    }
    next();
    
}
function checkNotAuthenticated(req,res,next){
    if(req.isAuthenticated()){
        return next();
    }
    return res.redirect("/login");
    
}




app.listen(PORT);