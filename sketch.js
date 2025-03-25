let engine;
let world;
let currentCar;
let grounds = [];
const POPULATION_SIZE = 20;
let currentGeneration = 1;
let currentIndex = 0;
let generationStartTime;
const CAR_TEST_DURATION = 5000; // 各車体の試行時間（ミリ秒）
const MUTATION_RATE = 0.1;
let population = []; // 遺伝情報を保存
let bestDistance = 0;
let bestGenome = null;

function setup() {
    createCanvas(800, 600);
    resetSimulation();
}

function resetSimulation() {
    // Matter.jsの初期化
    engine = Matter.Engine.create({
        gravity: { x: 0, y: 1, scale: 0.001 }
    });
    world = engine.world;
    
    // 地形の生成
    createTerrain();
    
    // 最初の車体を生成
    if (population.length < POPULATION_SIZE) {
        // 初期世代の場合、ランダムな遺伝情報を生成
        for (let i = 0; i < POPULATION_SIZE; i++) {
            population.push(generateRandomGenome());
        }
    }
    
    // 現在の個体を生成
    currentCar = new Car(150, 300, population[currentIndex]);
    generationStartTime = millis();
}

function generateRandomGenome() {
    // 車体の形状と車輪の位置をエンコード
    let vertices = [];
    for (let i = 0; i < 8; i++) {
        vertices.push({
            angle: random(TWO_PI),
            radius: random(20, 40)
        });
    }
    
    return {
        vertices: vertices,
        wheelPositions: [
            { x: random(-30, 30), y: random(0, 30) },
            { x: random(-30, 30), y: random(0, 30) }
        ]
    };
}

function draw() {
    background(220);
    
    // 物理エンジンの更新
    Matter.Engine.update(engine);
    
    // 地形の描画
    fill(128);
    for (let g of grounds) {
        beginShape();
        for (let v of g.vertices) {
            vertex(v.x, v.y);
        }
        endShape(CLOSE);
    }
    
    // 現在の車体の描画と更新
    if (currentCar) {
        currentCar.display();
        currentCar.update();
        
        // 情報表示
        fill(0);
        textSize(20);
        text(`Generation: ${currentGeneration}`, 20, 30);
        text(`Car: ${currentIndex + 1}/${POPULATION_SIZE}`, 20, 60);
        text(`Best Distance: ${floor(bestDistance)}`, 20, 90);
        text(`Current Distance: ${floor(currentCar.getDistance())}`, 20, 120);
        
        // 試行時間が終了したら次の車体へ
        if (millis() - generationStartTime > CAR_TEST_DURATION) {
            // 現在の車体の成績を記録
            let distance = currentCar.getDistance();
            if (distance > bestDistance) {
                bestDistance = distance;
                bestGenome = population[currentIndex];
            }
            
            // 次の車体へ
            currentIndex++;
            if (currentIndex >= POPULATION_SIZE) {
                // 世代の終了
                nextGeneration();
                currentIndex = 0;
                currentGeneration++;
            }
            
            // シミュレーションをリセット
            resetSimulation();
        }
    }
}

class Car {
    constructor(x, y, genome) {
        this.x = x;
        this.y = y;
        this.genome = genome;
        this.chassis = this.createChassis();
        this.wheels = this.createWheels();
        this.startX = x;
    }
    
    createChassis() {
        let vertices = [];
        for (let v of this.genome.vertices) {
            let x = this.x + cos(v.angle) * v.radius;
            let y = this.y + sin(v.angle) * v.radius;
            vertices.push(Matter.Vector.create(x, y));
        }
        
        let body = Matter.Bodies.fromVertices(this.x, this.y, [vertices], {
            friction: 0.5,
            restitution: 0.3
        });
        Matter.World.add(world, body);
        return body;
    }
    
    createWheels() {
        let wheels = [];
        for (let pos of this.genome.wheelPositions) {
            let wheel = Matter.Bodies.circle(
                this.x + pos.x,
                this.y + pos.y,
                15,
                {
                    friction: 0.7,
                    restitution: 0.2
                }
            );
            Matter.World.add(world, wheel);
            
            let constraint = Matter.Constraint.create({
                bodyA: this.chassis,
                bodyB: wheel,
                pointA: { x: pos.x, y: pos.y },
                stiffness: 0.5,
                length: 0
            });
            Matter.World.add(world, constraint);
            
            wheels.push({ body: wheel, constraint });
        }
        return wheels;
    }
    
    display() {
        // シャーシの描画
        fill(200, 100, 100);
        beginShape();
        for (let v of this.chassis.vertices) {
            vertex(v.x, v.y);
        }
        endShape(CLOSE);
        
        // タイヤの描画
        fill(50);
        for (let wheel of this.wheels) {
            ellipse(wheel.body.position.x, wheel.body.position.y, 30, 30);
        }
    }
    
    update() {
        // 簡単な動力の追加
        for (let wheel of this.wheels) {
            Matter.Body.setAngularVelocity(wheel.body, 0.1);
        }
    }
    
    getDistance() {
        return this.chassis.position.x - this.startX;
    }
}

function createTerrain() {
    let segments = 10;
    let points = [];
    
    // スタート地点は平らに
    points.push({ x: 0, y: height - 100 });
    points.push({ x: 300, y: height - 100 });
    
    // その後は起伏のある地形
    for (let i = 2; i <= segments; i++) {
        let x = map(i, 2, segments, 300, width);
        let y = height - 100 + random(-30, 30);
        if (i === segments) y = height - 100; // 終点も平らに
        points.push({ x, y });
    }
    
    // 地形の生成
    for (let i = 0; i < points.length - 1; i++) {
        let vertices = [
            { x: points[i].x, y: points[i].y },
            { x: points[i + 1].x, y: points[i + 1].y },
            { x: points[i + 1].x, y: height },
            { x: points[i].x, y: height }
        ];
        let ground = Matter.Bodies.fromVertices(
            (points[i].x + points[i + 1].x) / 2,
            (points[i].y + points[i + 1].y) / 2,
            [vertices],
            { 
                isStatic: true,
                friction: 0.5,
                restitution: 0.2
            }
        );
        Matter.World.add(world, ground);
        grounds.push(ground);
    }
}

function nextGeneration() {
    // 現在の世代をフィットネスでソート
    let sortedPopulation = [...population];
    sortedPopulation.sort((a, b) => {
        let distanceA = bestDistance; // ここは実際の距離を使用する必要があります
        let distanceB = bestDistance;
        return distanceB - distanceA;
    });
    
    let newPopulation = [];
    
    // エリート選択（上位2個体をそのまま次世代に）
    newPopulation.push(sortedPopulation[0]);
    newPopulation.push(sortedPopulation[1]);
    
    // 残りの個体を交配で生成
    while (newPopulation.length < POPULATION_SIZE) {
        let parent1 = selectParent(sortedPopulation);
        let parent2 = selectParent(sortedPopulation);
        let child = crossover(parent1, parent2);
        child = mutate(child);
        newPopulation.push(child);
    }
    
    population = newPopulation;
}

function selectParent(sortedPopulation) {
    // トーナメント選択
    let tournament = [];
    for (let i = 0; i < 3; i++) {
        tournament.push(sortedPopulation[floor(random(sortedPopulation.length))]);
    }
    return tournament[0]; // 簡略化のため、最初の個体を選択
}

function crossover(parent1, parent2) {
    let child = {
        vertices: [],
        wheelPositions: []
    };
    
    // 頂点の交配
    for (let i = 0; i < parent1.vertices.length; i++) {
        if (random() < 0.5) {
            child.vertices.push({...parent1.vertices[i]});
        } else {
            child.vertices.push({...parent2.vertices[i]});
        }
    }
    
    // 車輪位置の交配
    for (let i = 0; i < parent1.wheelPositions.length; i++) {
        if (random() < 0.5) {
            child.wheelPositions.push({...parent1.wheelPositions[i]});
        } else {
            child.wheelPositions.push({...parent2.wheelPositions[i]});
        }
    }
    
    return child;
}

function mutate(genome) {
    // 頂点の突然変異
    for (let vertex of genome.vertices) {
        if (random() < MUTATION_RATE) {
            vertex.angle += random(-0.5, 0.5);
            vertex.radius += random(-5, 5);
            vertex.radius = constrain(vertex.radius, 20, 40);
        }
    }
    
    // 車輪位置の突然変異
    for (let pos of genome.wheelPositions) {
        if (random() < MUTATION_RATE) {
            pos.x += random(-5, 5);
            pos.y += random(-5, 5);
            pos.x = constrain(pos.x, -30, 30);
            pos.y = constrain(pos.y, 0, 30);
        }
    }
    
    return genome;
}