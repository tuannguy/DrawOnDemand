let inputButton = document.getElementById('inputButton');
let inputText = document.getElementById('inputText');
let loaderScreen = document.getElementById('loaderScreen');


inputButton.addEventListener("click", () => {;
  sanitizeInput(inputText.value);
});

function sanitizeInput(input) {

  let invalidCharacters =  input.match(/[^a-zA-Z\s-]/g);
  if (invalidCharacters && invalidCharacters.length > 0) {
    alert(`Input has these invalid characters: ${invalidCharacters}`);
    loaderScreen.style.display = 'none';
    return;
  }

  input = input.trim();
  input = input.replace(/ /g, '-');

  drawIt(input);
}

async function decrementStrokeDashoffset(strokeDashoffset) {
  return new Promise(resolve => {
    strokeDashoffset -= 10;
    setTimeout(() => {
      resolve(strokeDashoffset); 
    }, 5);
  });
}

async function drawIt(subject) {

  loaderScreen.style.display = 'block';
  let endpoint = `/api/v1/image/getImage/${subject}`;
  let svgContents = await axios(endpoint)
          .then(response => response.data.data)
          .catch(error => {
              alert(`${error.message}\n${error.response.data.error}`);
          });

  if (svgContents) {

    loaderScreen.style.display = 'none';
    svgContainer = document.getElementById('svgContainer');
    svgContainer.innerHTML = svgContents;
    svgContainer.style.display = 'block';

    let pathIndex = 1;
    
    while (pathIndex <= document.getElementsByTagName('path').length) {

      let path = document.querySelector(`path:nth-child(${pathIndex})`);
      
      let stroke = path.attributes['stroke'].value;
      let rbgParamString = stroke.match(/(?<=\().+(?=\))/)[0]; // string between parentheses
      let rbgParams = rbgParamString.split(',');
      let darkColoredStroke = true;

      for (rbgParam of rbgParams) {
          if (parseInt(rbgParam) > 120) {
            darkColoredStroke = false;
            break;
          }
      }

      if (darkColoredStroke) {

        let pathD = path.attributes['d'].value;
        let prevPath = path;

        while (pathD.match(/Z/g) != null) {

          pathD = pathD.replace(/^[^Z]*Z /g,
            (match) => {
                let newPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                newPath.setAttribute('d', match);
                let pathLength = newPath.getTotalLength();
                if (pathLength > 10) {  // ignore tiny lines
                  for (atributeIndex = 0; atributeIndex < path.attributes.length - 1; atributeIndex++) {
                    let attributeValue;
                    if (path.attributes[atributeIndex].name == 'fill') {
                      attributeValue = 'transparent';
                    } else {
                      attributeValue = path.attributes[atributeIndex].value;
                    }
                    newPath.setAttribute(path.attributes[atributeIndex].name, attributeValue);
                  }
                  newPath.style.strokeDasharray = pathLength;
                  newPath.style.strokeDashoffset = pathLength;
                  path.parentNode.insertBefore(newPath, prevPath.nextSibling);
                  prevPath = newPath;
                  pathIndex++
                }
                return '';
            }
          );
        }
      }
      path.remove();
    }

    let pencil = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    pencil.id = 'pencil';
    pencil.setAttribute('href', '../images/pencil.svg');
    let penHeight = '100';
    pencil.setAttribute('height', penHeight);
    document.getElementsByTagName('svg')[0].appendChild(pencil);
    
    for (let path of document.getElementsByTagName('path')) {
      let pathLength = path.getTotalLength();
      while (path.style.strokeDashoffset > 0) {
        await decrementStrokeDashoffset(path.style.strokeDashoffset)
          .then(offSet => {
            if (offSet < 0) {
              offSet = 0;
            }
            path.style.strokeDashoffset = offSet;
            let penTip = path.getPointAtLength(pathLength - offSet);
            pencil.setAttribute(
              "transform",
              "translate(" +
                [penTip.x, penTip.y-penHeight] +
                ")"
            );
          });
      }
    }

    pencil.style.display = 'none';
  }

  loaderScreen.style.display = 'none';
}