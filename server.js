const express = require("express");
const bodyParser = require("body-parser");
const mysql = require("mysql2");
const path = require("path");
const db = require("./config/db");
const { checkToken } = require("./auth/token_validation");
const { genSaltSync, hashSync, compareSync } = require("bcrypt");
const { sign } = require("jsonwebtoken");
const jwtKey = require("./config/jwt-key");

var randomize = function (base) {
    var d, returnValue, r;

    d = new Date().getTime();
    returnValue = base.replace(/[xy]/g, function (c) {
        r = (d + Math.random() * 16) % 16 | 0;
        d = Math.floor(d / 16);

        return (c == 'x' ? r : (r & 0x7 | 0x8)).toString(16);
    });

    return returnValue;
};
/*
* Creates a unique user id
* @method uuid
* @return {String} uuid A unique string in a uuid format
*/
var uuid = function uuid() {
    return randomize('xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx');
};


const app = express();

app.use(bodyParser.json());


//START CREATE USER
const create = (data, callback) => {
    db.query(
        `insert into user(theme,email,level,password)
                      values(?,?,?)`,
        [data.theme, data.email, data.level, data.password],
        (error, results, fields) => {
            if (error) {
                return callback(error);
            }
            return callback(null, results);
        }
    );
};

app.post("/newUser", (req, res) => {
    const body = req.body;

    console.log("JSON.stringify(req.body): " + JSON.stringify(req.body));


    const salt = genSaltSync(10);
    body.password = hashSync(body.password, salt);
    create(body, (err, results) => {
        if (err) {
            return res.status(500).json({
                success: 0,
                message: "There was 500 error: " + err,
            });
        }
        return res.status(200).json({
            success: 1,
            data: results,
        });
    });
});

//END CREATE USER

//START LOGIN
const saveToken = (token, email) => {
    let sql = `UPDATE user SET token = '${token}' WHERE email = "${email}"`;
    let query = db.query(sql, (err, result) => {
        if (err) {
            console.log("There was an error on the server side: " + err);
        } else {
            console.log("That worked. here is the token result: " + JSON.stringify(result));
        }
    });
};

const getUserByUserEmail = (email, callback) => {
    db.query(
        `SELECT * FROM user WHERE email = ?`,
        [email],
        (error, results, fields) => {
            if (error) {
                return callback(error);
            }
            return callback(null, results[0]);

        }
    )
}

app.post("/login", (req, res) => {
    const body = req.body;
    getUserByUserEmail(body.email, (err, results) => {
        if (err) {
            console.log(err);
            if (err === "ECONNRESET") {
                console.log("WAKE UP CONNECTION! " + err);
            }
        }
        if (!results) {
            return res.json({
                success: 0,
                data: "Invalid email or password NO RESULTS: " + body.email,
            })
        }
        const result = compareSync(body.password, results.password);
        if (result) {
            results.password = undefined;
            const jsontoken = sign(
                {
                    results: results
                },
                jwtKey,
                {
                    expiresIn: "1h",
                }
            );

            if (jsontoken) {
                saveToken(jsontoken, body.email);
                console.log("trying to fire saved token.");
            }

            return res.json({
                success: 1,
                message: "Login Successful",
                token: jsontoken,
                id: results.id,
            })
        } else {
            return res.json({
                success: 0,
                data: "Invalid email or password COMPARISON FAIL."
            });
        }
    });
});

//START LOGOUT

app.put("/logout-uuid", (req, res) => {
    let serverLogOut = req.body.uuid + ":" + uuid();
    let sql = `UPDATE user SET token = '${serverLogOut}' WHERE email = "${req.body.email}"`;
    let query = db.query(sql, (err, result) => {
        if (err) {
            res.send("Setting logout token failed. " + err);
        } else {

            res.send("logout uuid saved.");
        }
    })
});


//START DELETE USER
app.delete("/delete-user/:email", checkToken, (req, res) => {
    let sql = "DELETE FROM user WHERE email = '" + req.params.email + "'";
    let query = db.query(sql, (err, result) => {
        if (err) {
            console.log(err);
        } else {
            console.log(result);
            res.send(req.params);
        }
    })
});


//START EDIT LEVEL 
app.put("/edit-level", checkToken, (req, res) => {
    let sql = `UPDATE user SET level = '${req.body.level}WHERE email = "${req.body.email}"`;
    let query = db.query(sql, (err, result) => {
        if (err) {
            console.log(err);
        } else {
            console.log(result);
            res.send(result);
        }
    });
});

//START GET LEVEL
app.get("/level/:email", (req, res) => {
    let sql = `SELECT level FROM user WHERE email = '${req.params.email}'`;
    let query = db.query(sql, (err, result) => {
        if (err) {
            console.log(err);
        } else {
            res.json(results);
        }
    });
});

//START REFRESH
app.get("/check-token/:email", checkToken, (req, res) => {
    let sql = `SELECT token FROM user WHERE email = '${req.params.email}'`;
    let query = db.query(sql, (err, results) => {
        if (err) {
            console.log("check for token: " + err);
        } else {
            res.send(results);
        }
    });
});

//START CHANGE PASSWORD

app.put("/change-password", checkToken, (req, res) => {
    const body = req.body;
    const salt = genSaltSync(10);
    body.password = hashSync(body.password, salt);
    let sql = `UPDATE user SET password = '${body.password}' WHERE email = '${body.email}'`;
    let query = db.query(sql, (err, result) => {
        if (err) {
            console.log(err);
        } else {
            console.log(result);
            res.send(result);
        }
    })

});
//USER EDIT THEME START

app.put("/edit-theme", checkToken, (req, res) => {
    let sql = `UPDATE user SET theme = '${req.body.theme}' WHERE email = "${req.body.email}"`;
    let query = db.query(sql, (err, result) => {
        if (err) {
            console.log(err);
        } else {
            console.log(result);
            res.send(result);
        }
    });
});

//USER EDIT THEME END

//START GET THEME
app.get("/theme/:email", (req, res) => {
    let sql = `SELECT theme FROM user WHERE email = '${req.params.email}'`;
    let query = db.query(sql, (err, results) => {
        if (err) {
            console.log(err);
        } else {
            res.json(results);
        }
    });
});

//END GET THEME






if (process.env.NODE_ENV === "production") {
    app.use(express.static("client/build"));

    app.get("*", (req, res) => {
        res.sendFile(path.resolve(__dirname, "client", "build", "index.html"));

    });
}

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`You fired up PORT ${PORT} successfully.`));