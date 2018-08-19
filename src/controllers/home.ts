import { Request, Response } from "express";
const request = require("request");

function authStep1 () {
  return new Promise(  function(resolve, reject) {
    const options = {
      url:
      "https://developer.api.autodesk.com/authentication/v1/authorize" +
      "?response_type=code" +
      "&client_id=" + process.env.ADSK_CLIENT_ID +
      "&redirect_uri=" + process.env.ADSK_CALLBACK_URI +
      "&scope=data:read",
      method: "GET"
    };
    request(options, function (error: Error, response: Response, body: Body) {
      if (!error) {
        resolve();
      }
      else {
        reject(error);
      }
    });
  });
}

function authStep2 (req: Request, res: Response) {
  return new Promise(  function(resolve, reject) {
    const data =
      "client_id=" + process.env.ADSK_CLIENT_ID + "&" +
      "client_secret=" + process.env.ADSK_CLIENT_SECRET + "&" +
      "grant_type=authorization_code&" +
      "code=" + req.query.code + "&" +
      "redirect_uri=" + process.env.ADSK_CALLBACK_URI;

    const options = {
      url: "https://developer.api.autodesk.com/authentication/v1/gettoken",
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded"
      },
      body: data
    };
    request(options, function (error: Error, response: Response, body: Body) {
      if (!error) {
        resolve(body);
        res.render("account/signup", {
          title: "getadsklogin response" + body
        });
      }
      else {
        reject(error);
      }
    });
  });
}

/**
 * GET /
 * Home page.
 */
export let index = (req: Request, res: Response) => {
  if (!req.query.code) {
    authStep1();
  }
  else {
    authStep2(req, res);
  }
};
