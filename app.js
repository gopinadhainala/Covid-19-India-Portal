const express = require("express");
const instanceOfExpress = express();
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
instanceOfExpress.use(express.json());
let database = null;

const connectDbAndStartServer = async () => {
  try {
    database = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    instanceOfExpress.listen(3000, (request, response) => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (error) {
    console.log(`Db Error : ${error.message}`);
  }
};

connectDbAndStartServer();

//Middleware Function
const verifyToken = (request, response, succeeding) => {
  let jwtToken;
  const authHeaders = request.headers["authorization"];
  if (authHeaders !== undefined) {
    jwtToken = authHeaders.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "GangLeader", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        succeeding();
      }
    });
  }
};
//State response Object
const convertDbToResponseObj = (eachState) => {
  return {
    stateId: eachState.state_id,
    stateName: eachState.state_name,
    population: eachState.population,
  };
};
//API 1
instanceOfExpress.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const checkQuery = `SELECT * FROM user WHERE username = "${username}";`;
  const dbUser = await database.get(checkQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const verifyPassword = await bcrypt.compare(password, dbUser.password);
    const payload = { username: username };
    if (verifyPassword === true) {
      const jwtToken = jwt.sign(payload, "GangLeader");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//API 2
instanceOfExpress.get("/states/", verifyToken, async (request, response) => {
  const getQuery = `SELECT * FROM state;`;
  const dbObject = await database.all(getQuery);
  response.send(
    dbObject.map((eachStateObject) => convertDbToResponseObj(eachStateObject))
  );
});

//API 3
instanceOfExpress.get(
  "/states/:stateId/",
  verifyToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getSingleQuery = `SELECT * FROM state Where state_id = ${stateId};`;
    const dbObject = await database.get(getSingleQuery);
    response.send(convertDbToResponseObj(dbObject));
  }
);

//API 4
instanceOfExpress.post(
  "/districts/",
  verifyToken,
  async (request, response) => {
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const postQuery = `INSERT INTO district ("district_name","state_id","cases","cured","active","deaths") Values
  ("${districtName}",${stateId},${cases},${cured},${active},${deaths});`;
    const dbObject = await database.run(postQuery);
    response.send("District Successfully Added");
  }
);

//API 5
instanceOfExpress.get(
  "/districts/:districtId/",
  verifyToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getSingleQuery = `SELECT * FROM district Where district_id = ${districtId};`;
    const dbObject = await database.get(getSingleQuery);
    response.send({
      districtId: dbObject.district_id,
      districtName: dbObject.district_name,
      stateId: dbObject.state_id,
      cases: dbObject.cases,
      cured: dbObject.cured,
      active: dbObject.active,
      deaths: dbObject.deaths,
    });
  }
);

//API 6
instanceOfExpress.delete(
  "/districts/:districtId/",
  verifyToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteQuery = `DELETE FROM district WHERE district_id = ${districtId};`;
    const updatedDb = await database.run(deleteQuery);
    response.send("District Removed");
  }
);

//API 7
instanceOfExpress.put(
  "/districts/:districtId/",
  verifyToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const putQuery = `UPDATE district SET district_name = "${districtName}",
    state_id = ${stateId},cases = ${cases},cured = ${cured},active = ${active},deaths = ${deaths} WHERE 
    district_id = ${districtId};`;
    const dbUser = await database.run(putQuery);
    response.send("District Details Updated");
  }
);

instanceOfExpress.get(
  "/states/:stateId/stats/",
  verifyToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getSingleQuery = `SELECT SUM(cases),SUM(cured),SUM(active),SUM(deaths) FROM district NATURAL JOIN state WHERE state_id = ${stateId};`;
    const dbObject = await database.get(getSingleQuery);
    response.send({
      totalCases: dbObject["SUM(cases)"],
      totalCured: dbObject["SUM(cured)"],
      totalActive: dbObject["SUM(active)"],
      totalDeaths: dbObject["SUM(deaths)"],
    });
  }
);

module.exports = instanceOfExpress;
