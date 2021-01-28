'use strict';

const jwt = require(`jsonwebtoken`);
const {storage} = require(`../../storage-db`);
const {HttpCode, RegisterMessage, LoginMessage} = require(`../../constants`);
const {getLogger} = require(`../../logger`);
const {comparePassHashSum, makeTokens} = require(`../../utils`);

//const JWT_ACCESS_SECRET = `secret`;
const JWT_REFRESH_SECRET = `secret-refresh`;

const logger = getLogger();

module.exports.checkUserExists = async (req, res, next) => {
  const existsUser = await storage.checkEmail(req.body);

  if (existsUser) {
    logger.error(`End request with error ${HttpCode.BAD_REQUEST}`);
    //return res.status(HttpCode.OK).json(RegisterMessage.USER_ALREADY_REGISTER);
    return res.status(HttpCode.BAD_REQUEST).json([RegisterMessage.USER_ALREADY_REGISTER]);
  }
  return next();
};

module.exports.authenticateUser = async (req, res, next) => {
  const existsUser = await storage.checkEmail(req.body);

  if (!existsUser) {
    logger.error(`End request with error ${HttpCode.FORBIDDEN}`);
    return res.status(HttpCode.FORBIDDEN).json(LoginMessage.USER_NOT_EXISTS);
  }

  const isPasswordCorrect = await comparePassHashSum(existsUser, req.body.pass);

  if (!isPasswordCorrect) {
    logger.error(`End request with error ${HttpCode.FORBIDDEN}`);
    return res.status(HttpCode.FORBIDDEN).json(LoginMessage.WRONG_PASSWORD);
  }
  res.locals.user = existsUser;
  return next();
};

module.exports.createUser = async (req, res) => {
  const user = await storage.addNewUser(req.body);

  if (!user) {
    logger.error(`End request with error ${HttpCode.NOT_FOUND}`);
    return res.status(HttpCode.NOT_FOUND).end();
  }

  logger.info(`End request with status code ${res.statusCode}`);
  return res.status(HttpCode.CREATED).json(user);
};

module.exports.makeTokens = async (req, res) => {
  const id = res.locals.user.user_id;

  const {accessToken, refreshToken} = makeTokens({id});
  await storage.addRefreshToken(refreshToken);
  return res.json({accessToken, refreshToken});
};

module.exports.refreshTokens = async (req, res) => {
  const {token} = req.body;

  if (!token) {
    logger.error(`End request with error ${HttpCode.BAD_REQUEST}`);
    return res.status(HttpCode.BAD_REQUEST);
  }

  const currentToken = await storage.findRefreshToken(token);

  if (!currentToken) {
    logger.error(`End request with error ${HttpCode.NOT_FOUND}`);
    return res.status(HttpCode.NOT_FOUND);
  }

  jwt.verify(token, JWT_REFRESH_SECRET, async (err, userData) => {

    if (err) {
      logger.error(`End request with error ${HttpCode.FORBIDDEN}`);
      return res.status(HttpCode.FORBIDDEN);
    }

    const {id} = userData;
    const {accessToken, refreshToken} = makeTokens({id});

    await storage.deleteRefreshToken(currentToken);
    await storage.addRefreshToken(refreshToken);

    return res.json({accessToken, refreshToken});
  });
};
