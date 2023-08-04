// Revision of Activity

// npm init -y
// npm install minimist
// npm install axios
// npm install jsdom
// npm install excel4node
// npm install pdf-lib

// Terminal : node 1CricinfoExtracter.js --excel=worldcup.csv --dataDir=worldcup --source=https://www.espncricinfo.com/series/icc-cricket-world-cup-2019-1144415/match-schedule-fixtures-and-results

// Format : Alt + Shift + F

let minimist = require("minimist");
let axios = require("axios");
let jsdom = require("jsdom");
let excel4node = require("excel4node");
let pdf = require("pdf-lib");
let fs = require("fs");
let path = require("path");

// Convert matches to teams
// save teams to excel using excel4node
// create folders and save pdf using pdf-lib

let args = minimist(process.argv);

// browser => url to html (url se http request -> server ne html in http responce)

let responceKaPromise = axios.get(args.source);
responceKaPromise.then(function(responce){
    let html = responce.data;
    let dom = new jsdom.JSDOM(html);
    let document = dom.window.document;
    
    let matchScoreDives = document.querySelectorAll("div.ds-grow");  // it returns array(list) 
    // console.log(matchScoreDives.length);
    // There are 48 matches only but in this it came 50
    // thats why taking loop from i = 2


    let matches = [];
    for(let i = 2; i < matchScoreDives.length; i++){
        let match = {
            t1: "",
            t2: "",
            t1s: "",
            t2s: "",
            result: ""
        };

        let namePs = matchScoreDives[i].querySelectorAll("p.ds-text-tight-m");
        match.t1 = namePs[0].textContent;
        match.t2 = namePs[1].textContent;
        
        let scoreSpans = matchScoreDives[i].querySelectorAll("div.ds-text-compact-s > strong");
        if(scoreSpans.length == 2){
            match.t1s = scoreSpans[0].textContent;
            match.t2s = scoreSpans[1].textContent;
        }else if(scoreSpans.length == 1){
            match.t1s = scoreSpans[0].textContent;
            match.t2s = "";
        }else {
            match.t1s = "";
            match.t2s = "";
        }

        let spanResult = matchScoreDives[i].querySelectorAll("p.ds-text-tight-s > span");
        match.result = spanResult[0].textContent;
            
        matches.push(match);
    }

    // console.log(matches);

    let matchesJSON = JSON.stringify(matches);
    fs.writeFileSync("matches.json", matchesJSON, "utf-8");

    let teams = [];
    for(let i = 0; i < matches.length; i++){
        pushTeamInteamsIfAlreadyNotThere(teams, matches[i].t1);
        pushTeamInteamsIfAlreadyNotThere(teams, matches[i].t2);
    }

    for(let i = 0; i < matches.length; i++){
        putMatchInAppropriateteam(teams, matches[i]);
    }

    let teamsJSON = JSON.stringify(teams);
    fs.writeFileSync("teams.json", teamsJSON, "utf-8");

    createExcelFile(teams);
    createFolders(teams);

}).catch(function(err){
    console.log(err);
})

function pushTeamInteamsIfAlreadyNotThere(teams, teamName){
    let tidx = teams.findIndex(function(team){
        if(team.name == teamName){
            return true;
        }else{
            return false;
        }
    });

    if(tidx == -1){
        let team = {
            name: teamName,
            matches: []
        };
        teams.push(team);
    }
}

function putMatchInAppropriateteam(teams, match){
    let t1idx = -1;
    for(let i = 0; i < teams.length; i++){
        if(teams[i].name == match.t1){
            t1idx = i;
            break;
        }
    }

    let team1 = teams[t1idx];
    team1.matches.push({
        vs: match.t2,
        selfScore: match.t1s,
        oppScore: match.t2s,
        result: match.result
    });

    let t2idx = -1;
    for(let i = 0; i < teams.length; i++){
        if(teams[i].name == match.t2){
            t2idx = i;
            break;
        }
    }

    let team2 = teams[t2idx];
    team2.matches.push({
        vs: match.t1,
        selfScore: match.t2s,
        oppScore: match.t1s,
        result: match.result
    });
}

function createExcelFile(teams){
    let wb = new excel4node.Workbook();

    for(let i = 0; i < teams.length; i++){
        let sheet = wb.addWorksheet(teams[i].name);

        sheet.cell(1, 1).string("VS");
        sheet.cell(1, 2).string("Self Score");
        sheet.cell(1, 3).string("Opp Score");
        sheet.cell(1, 4).string("Result");

        for(let j = 0; j < teams[i].matches.length; j++){
            sheet.cell(j + 2, 1).string(teams[i].matches[j].vs);
            sheet.cell(j + 2, 2).string(teams[i].matches[j].selfScore);
            sheet.cell(j + 2, 3).string(teams[i].matches[j].oppScore);
            sheet.cell(j + 2, 4).string(teams[i].matches[j].result);
        }
    }

    wb.write(args.excel);
}

function createFolders(teams){
    if(fs.existsSync(args.dataDir)){
        fs.rmdirSync(args.dataDir, { recursive: true});
    }
    fs.mkdirSync(args.dataDir);

    for(let i = 0; i < teams.length; i++){
        let teamFolder = path.join(args.dataDir, teams[i].name);
        fs.mkdirSync(teamFolder);                           // making folder for each team
    
        for(let j = 0; j < teams[i].matches.length; j++){
            let matchFileName = path.join(teamFolder, teams[i].matches[j].vs);
            // fs.writeFileSync(matchFileName, "", "utf-8");
            createScoreCard(teams[i].name, teams[i].matches[j], matchFileName);
        }
    
    }
}

function createScoreCard(teamName, match, matchFileName){
    // this fn creates pdf for match in appropriate folder with correct details
    // here we will use pdf-lib to create the pdf

    let t1 = teamName;
    let t2 = match.vs;
    let t1s = match.selfScore;
    let t2s = match.oppScore;
    let result = match.result;

    let originalBytes = fs.readFileSync("Template.pdf");

    let promiseToLoadBytes = pdf.PDFDocument.load(originalBytes);
    promiseToLoadBytes.then(function(pdfdoc) {
        let page = pdfdoc.getPage(0);
        page.drawText(t1, {
            x: 320,
            y: 690,
            size: 13
        });

        page.drawText(t2, {
            x: 320,
            y: 668,
            size: 13
        });

        page.drawText(t1s, {
            x: 320,
            y: 646,
            size: 13
        });

        page.drawText(t2s, {
            x: 320,
            y: 624,
            size: 13
        });

        page.drawText(result, {
            x: 320,
            y: 602,
            size: 13
        });

        let prmToSave = pdfdoc.save();
        prmToSave.then(function(changedBytes){
            if(fs.existsSync(matchFileName + ".pdf")){
                fs.writeFileSync(matchFileName + "1.pdf", changedBytes);
            }else{
                fs.writeFileSync(matchFileName + ".pdf", changedBytes);
            }
            
        });
    });
    
}