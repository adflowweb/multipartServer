/**
 * User: nadir93
 * Date: 2014. 2. 4.
 * Time: 오후 2:00
 */
var express = require('express');
var fs = require('fs');
var app = express();
var util = require('util');
var JSFtp = require("jsftp");
var redis = require('redis').createClient();

//var hostName = '192.168.1.69';
//var portNum = 21;
//var userName = 'pcert';
//var password = 'pcert';

var hostName = '192.168.1.45';
var portNum = 21;
var userName = 'root';
var password = 'root';

//redis error
redis.on('error', function (err) {
    console.error(err.stack);
});

//redis ready
redis.on('ready', function () {
    console.info('redis server ready');
});

//all environments
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.logger());
//app.use(rawBody);
app.use(express.bodyParser({ keepExtensions: true, uploadDir: '/home/master/nodejs/upload' }));
//app.use(express.bodyParser({ keepExtensions: true, uploadDir: '/Users/nadir93/downloads' }));
app.use(function(req, res, next){
    if (req.is('text/*')) {
        req.text = '';
        req.setEncoding('utf8');
        req.on('data', function(chunk){ req.text += chunk });
        req.on('end', next);
    } else {
        next();
    }
});
app.use(express.methodOverride());

app.get('/upload', function(req, res){
    // show a file upload form
    res.writeHead(200, {'content-type': 'text/html'});
    res.end(
        '<form action="/upload" enctype="multipart/form-data" method="post">'+
            '<input type="text" name="title"><br>'+
            '<input type="file" name="upload" multiple="multiple"><br>'+
            '<input type="submit" value="Upload">'+
            '</form>'
    );
});

app.post('/upload', function(req, res){

//    console.log('req::'+util.inspect(req));
//    // parse a file upload
//    var form = new formidable.IncomingForm();
//
//    form.parse(req, function(err, fields, files) {
//        res.writeHead(200, {'content-type': 'text/plain'});
//        res.write('received upload:\n\n');
//        res.end(util.inspect({fields: fields, files: files}));
//    });


    try {
        console.log('req::'+util.inspect(req.files));


        var ftp = new JSFtp({
            host: hostName,
            port: portNum, // defaults to 21
            user: userName, // defaults to "anonymous"
            pass: password // defaults to "@anonymous"
        });

        var keys = Object.keys(req.files);
        console.log('keys::'+keys);



//        for(k in req.files){
//            ftp.raw.mkd(k, function(err, data) {
//                if (err) return console.error(err);
//                console.log(data.text); // Show the FTP response text to the user
//                console.log(data.code); // Show the FTP response code to the user
//
//                ftp.put(buffer, 'path/to/remote/file.txt', function(hadError) {
//                    if (!hadError)
//                        console.log("File transferred successfully!");
//                });
//            });
//        }
        ftp.raw.cwd(/*'/HOME'*/ '/root/upload', function(err, res) {
            if (err)
            {
                console.error(err);
                res.writeHead(200, {'content-type': 'text/plain'});
                res.write(err.message, 500);
                res.end();
                return;
            }
            process(0);
        });


        function process(i){
            if(i<keys.length)
            {
                ftp.raw.mkd(keys[i], function(err, data) {
                    if (err)
                    {
                        console.error(err);
                        res.writeHead(200, {'content-type': 'text/plain'});
                        res.write(err.message, 500);
                        res.end();
                        return;
                    }
                    console.log(data.text); // Show the FTP response text to the user
                    console.log(data.code); // Show the FTP response code to the user

                    console.log('fileCount::'+req.files[keys[i]].length);
                    if(req.files[keys[i]].length)
                    {
                        //multi files
                        (function processMultiFile(j)
                        {
                            if(j < req.files[keys[i]].length)
                            {
                                console.log('path::'+req.files[keys[i]][j].path);
                                fs.readFile(req.files[keys[i]][j].path, function (err, dataFile) {
                                    if (err)
                                    {
                                        console.error(err);
                                        res.writeHead(200, {'content-type': 'text/plain'});
                                        res.write(err.message, 500);
                                        res.end();
                                        return;
                                    }
                                    console.log(dataFile);
                                    console.log('fileName::'+keys[i]+'/'+req.files[keys[i]][j].originalFilename);
                                    ftp.put(dataFile, keys[i]+'/'+req.files[keys[i]][j].originalFilename, function(hadError) {
                                        if (hadError)
                                        {
                                            console.error(hadError);
                                            res.writeHead(200, {'content-type': 'text/plain'});
                                            res.write(hadError.message, 500);
                                            res.end();
                                            return;
                                        }
                                        console.log("File transferred successfully!");
                                        processMultiFile(++j);
                                    });
                                });
                            } else {
                                process(++i);
                            }
                        })(0);
                    } else {
                        //single file
                        console.log('path::'+req.files[keys[i]].path);
                        fs.readFile(req.files[keys[i]].path, function (err, dataFile) {
                            if (err)
                            {
                                console.error(err);
                                res.writeHead(200, {'content-type': 'text/plain'});
                                res.write(err.message, 500);
                                res.end();
                                return;
                            }
                            console.log(dataFile);
                            console.log('fileName::'+keys[i]+'/'+req.files[keys[i]].originalFilename);
                            ftp.put(dataFile, keys[i]+'/'+req.files[keys[i]].originalFilename, function(hadError) {
                                if (hadError)
                                {
                                    console.error(hadError);
                                    res.writeHead(200, {'content-type': 'text/plain'});
                                    res.write(hadError.message, 500);
                                    res.end();
                                    return;
                                }
                                console.log("File transferred successfully!");
                                process(++i);
                            });
                        });
                    }
                });
            } else {
                console.log('sessionid::'+req.headers['sessionid']);
                if (req.headers['sessionid'] /*&& exist virtualpage*/ ) {
                    // send virtual page
                    redis.hget('virtualpage', req.headers['sessionid'], function (err, reply) {
                        if (err) {
                            console.error(err.toString());
                            //res.send(err.message, 500);
                            return;
                        }

                        // reply is null when the key is missing
                        if (reply) {
                            console.log('reply::'+reply);
                            console.log('severdom::'+keys+'/server.dom');
                            console.log(new Buffer(reply, "utf-8"));
                            var normalizedData = normalize(reply);
                            console.log('normalizedData::'+normalizedData);
                            ftp.put(new Buffer(normalizedData, "binary"), keys+'/server.dom', function(hadError) {
                                if (hadError)
                                {
                                    console.error(hadError);
                                    res.writeHead(200, {'content-type': 'text/plain'});
                                    res.write(hadError.message, 500);
                                    res.end();
                                    return;
                                }
                                console.log("File transferred successfully!");
                                disconnect();
                            });
                        // res.send(reply);
                        } else {
                        //res.send(404);
                        }
                    });
                } else {
                    disconnect();
                }
            }
        }

        function disconnect()
        {
            //disconnect ftp session
            ftp.raw.quit(function(err, data) {
                if (err)
                {
                    console.error(err);
                }

                res.writeHead(200, {'content-type': 'text/plain'});
                res.write('{"success": true,"message": "file Sent"}');
                res.end();
                console.log("Bye!");
            });
        }

        // 파일 전송 코드
//        ftp.ls(".", function(err, response) {
//            if(err)
//            {
//                console.log(err.message);
//                return;
//            }
//            response.forEach(function(file) {
//                console.log(file.name);
//            });
//
//            ftp.raw.quit(function(err, data) {
//                if (err) return console.error(err);
//                console.log("Bye!");
//            });
//        });
        // txid로 폴더생성후 파일저장
    } catch (e) {
        console.log(e.toString());
        res.writeHead(200, {'content-type': 'text/plain'});
        res.write(e.message, 500);
        res.end();
    }
});
app.listen(3001);


function normalize(data) {
    //logger.debug(srcName + ' before data : ', data);
    var $ = parser.load('<html>' + data + '</html>');
    $('meta').remove(); //remove meta tag
    $('param').remove(); //remove param tag
    $('link[rel="stylesheet"]').remove(); //remove param tag
    $('*[style]').removeAttr('style'); //remove style attr
    $('*[value]').removeAttr('value'); //remove value attr
    $('*[type]').removeAttr('type'); //remove type attr
    //$('*[selected]').removeAttr(); //remove selected attr
    //$('img[@src$=.png']).removeAtrr('src');
    //console.log("test : ",);
    $('img[src$=".png"]').removeAttr('src');
    $('option[selected]').removeAttr('selected');
    $('option[selected]').removeAttr('selected');
    $('form[name="searchForm"]').removeAttr('id');
    $('link[href="/AAPlus/favicon.ico"]').remove();
    $('input').removeAttr('type');
    //$('*[rel]').removeAttr('rel');

    //logger.debug(__filename + ' before data : ', data);

    //var msg = $('html').text();
    var msg = $('html').html();
    //logger.debug(srcName + ' $("html").html() : ', msg);


    //testCode
    //msg = msg.replace(/style=\"[\w\#\'\(\)\-\.\,\/\:\;\_\s]*\"|value=\"\w+\"|type=\"[\w\/]+\"/g, '');
    //msg = msg.replace(/\<meta\scontent=[\w\"\#\(\)\-\.\,\/\:\;\_\s\=]*\/\>/g, '');
    //msg = msg.replace(/\<param\s[\w\=\"\'\s\r\n\/\.\,]*\/\>/g, '');
//logger.debug(srcName + ' test data : ', msg);
    //testEnd
    var normalizedData = encodeURIComponent(msg.replace(/[\n\r]/g, '').replace(/\s+/g, ''));
    //encodeURIComponent(data.replace(/[\n\r]/g, '').replace(/\s+/g, ''));
//logger.debug(srcName + ' normalizedData : ', normalizedData);
    return normalizedData;
};
