let engine;
let world;
let cars = [];
let ground = [];
const POPULATION_SIZE = 20;
let currentGeneration = 1;
let simulationTime = 0;
const SIMULATION_DURATION = 300;  // 各世代の評価時間
let bestFitness = 0;

function setup() {
    createCanvas(800, 600);
    
    // Matter.jsの初期化
    engine = Matter.Engine.create({
        gravity: { x: 0, y: 1, scale: 0.001 }
    });
    world = engine.world;
    
    // 物理演算の設定
    engine.world.gravity.y = 0.98;
    
    // decomp ライブラリの設定
    Matter.Common.setDecomp(decomp);
    
    // 地形の生成
    createTerrain();
    
    // 初期個体群の生成
    for (let i = 0; i < POPULATION_SIZE; i++) {
        cars.push(new Car(100, 300));
    }
}

function draw() {
    background(220);
    
    // 物理エンジンの更新
    Matter.Engine.update(engine);
    
    // 地形の描画
    fill(128);
    noStroke();
    for (let g of ground) {
        push();
        translate(g.position.x, g.position.y);
        rotate(g.angle);
        rectMode(CENTER);
        rect(0, 0, g.bounds.max.x - g.bounds.min.x, g.bounds.max.y - g.bounds.min.y);
        pop();
    }
    
    // 車の描画と更新
    for (let car of cars) {
        car.display();
        car.update();
        bestFitness = Math.max(bestFitness, car.fitness);
    }
    
    // シミュレーション時間の更新
    simulationTime++;
    
    // 一定時間経過後に世代交代
    if (simulationTime >= SIMULATION_DURATION) {
        nextGeneration();
        simulationTime = 0;
    }
    
    // 情報の表示
    fill(0);
    textSize(20);
    text(`Generation: ${currentGeneration}`, 20, 30);
    text(`Best Fitness: ${bestFitness.toFixed(2)}`, 20, 60);
}

class Car {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.chassis = this.createChassis();
        this.wheels = this.createWheels();
        this.fitness = 0;
    }
    
    createChassis() {
        let vertices = [];
        // ランダムな多角形の頂点を生成
        for (let i = 0; i < 8; i++) {
            let angle = map(i, 0, 8, 0, TWO_PI);
            let r = random(20, 40);
            let x = cos(angle) * r;
            let y = sin(angle) * r;
            vertices.push({ x, y });
        }
        
        let body = Matter.Bodies.fromVertices(this.x, this.y, vertices);
        Matter.World.add(world, body);
        return body;
    }
    
    createWheels() {
        let wheels = [];
        for (let i = 0; i < 2; i++) {
            let wheel = Matter.Bodies.circle(
                this.x + (i * 60 - 30),
                this.y + 30,
                15
            );
            Matter.World.add(world, wheel);
            
            let constraint = Matter.Constraint.create({
                bodyA: this.chassis,
                bodyB: wheel,
                stiffness: 0.5
            });
            Matter.World.add(world, constraint);
            
            wheels.push({ body: wheel, constraint });
        }
        return wheels;
    }
    
    display() {
        // シャーシの描画
        fill(200, 100, 100);
        noStroke();
        push();
        translate(this.chassis.position.x, this.chassis.position.y);
        rotate(this.chassis.angle);
        beginShape();
        for (let vertex of this.chassis.vertices) {
            let pos = Matter.Vector.sub(vertex, this.chassis.position);
            vertex(pos.x, pos.y);
        }
        endShape(CLOSE);
        pop();
        
        // タイヤの描画
        fill(50);
        for (let wheel of this.wheels) {
            circle(wheel.body.position.x, wheel.body.position.y, 30);
        }
    }
    
    update() {
        // 進んだ距離と安定性を考慮した適応度
        let distance = this.chassis.position.x - 100;  // 初期位置からの距離
        let stability = 1 / (1 + Math.abs(this.chassis.angle));  // 車体の傾きが少ないほど高スコア
        let speed = Math.abs(this.chassis.velocity.x);  // 速度も評価
        this.fitness = distance * stability * (0.5 + speed * 0.5);
        
        // 動力の追加（車輪の回転）
        Matter.Body.setAngularVelocity(this.wheels[0].body, 0.1);
        Matter.Body.setAngularVelocity(this.wheels[1].body, 0.1);
    }
    
    static crossover(parent1, parent2) {
        let child = new Car(100, 300);
        // 親の特徴を組み合わせて新しい車体を生成
        let vertices = [];
        for (let i = 0; i < 8; i++) {
            if (random() < 0.5) {
                vertices.push({
                    x: parent1.chassis.vertices[i].x - parent1.chassis.position.x,
                    y: parent1.chassis.vertices[i].y - parent1.chassis.position.y
                });
            } else {
                vertices.push({
                    x: parent2.chassis.vertices[i].x - parent2.chassis.position.x,
                    y: parent2.chassis.vertices[i].y - parent2.chassis.position.y
                });
            }
        }
        Matter.World.remove(world, child.chassis);
        child.chassis = Matter.Bodies.fromVertices(child.x, child.y, vertices);
        Matter.World.add(world, child.chassis);
        return child;
    }
    
    static mutate(car) {
        // ランダムな頂点を少し動かす
        let vertices = car.chassis.vertices.map(v => ({
            x: v.x - car.chassis.position.x,
            y: v.y - car.chassis.position.y
        }));
        
        for (let i = 0; i < vertices.length; i++) {
            if (random() < 0.1) {  // 10%の確率で突然変異
                vertices[i].x += random(-5, 5);
                vertices[i].y += random(-5, 5);
            }
        }
        
        Matter.World.remove(world, car.chassis);
        car.chassis = Matter.Bodies.fromVertices(car.x, car.y, vertices);
        Matter.World.add(world, car.chassis);
    }
}

function nextGeneration() {
    // 適応度でソート
    cars.sort((a, b) => b.fitness - a.fitness);
    
    // 上位50%を選択
    let selected = cars.slice(0, POPULATION_SIZE / 2);
    
    // 新しい世代の作成
    let newCars = [];
    
    // エリート保存（上位2個体をそのまま次世代に）
    newCars.push(new Car(100, 300));
    Object.assign(newCars[0].chassis.vertices, selected[0].chassis.vertices);
    newCars.push(new Car(100, 300));
    Object.assign(newCars[1].chassis.vertices, selected[1].chassis.vertices);
    
    // 残りは交配と突然変異で生成
    while (newCars.length < POPULATION_SIZE) {
        let parent1 = selected[Math.floor(random(selected.length))];
        let parent2 = selected[Math.floor(random(selected.length))];
        let child = Car.crossover(parent1, parent2);
        Car.mutate(child);
        newCars.push(child);
    }
    
    // 古い個体の削除
    for (let car of cars) {
        Matter.World.remove(world, car.chassis);
        for (let wheel of car.wheels) {
            Matter.World.remove(world, wheel.body);
            Matter.World.remove(world, wheel.constraint);
        }
    }
    
    cars = newCars;
    currentGeneration++;
}

function createTerrain() {
    let segments = 10;
    let points = [];
    
    // 地形のポイントを生成
    for (let i = 0; i <= segments; i++) {
        let x = map(i, 0, segments, 0, width);
        let y = height - 100 + random(-30, 30);
        if (i === 0) y = height;
        if (i === segments) y = height;
        points.push({ x, y });
    }
    
    // 地形のセグメントを生成
    for (let i = 0; i < points.length - 1; i++) {
        let segment = Matter.Bodies.rectangle(
            (points[i].x + points[i + 1].x) / 2,
            (points[i].y + points[i + 1].y) / 2,
            points[i + 1].x - points[i].x,
            20,
            { 
                isStatic: true,
                angle: Math.atan2(
                    points[i + 1].y - points[i].y,
                    points[i + 1].x - points[i].x
                )
            }
        );
        Matter.World.add(world, segment);
        ground.push(segment);
    }
    
    // 地面の壁を追加
    let floor = Matter.Bodies.rectangle(width/2, height + 10, width, 20, { isStatic: true });
    Matter.World.add(world, floor);
    ground.push(floor);
}