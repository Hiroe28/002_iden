let engine;
let world;
let cars = [];
let grounds = [];
const POPULATION_SIZE = 20;
let currentGeneration = 1;

function setup() {
    createCanvas(800, 600);
    
    // Matter.jsの初期化
    engine = Matter.Engine.create({
        gravity: { x: 0, y: 1, scale: 0.001 }
    });
    world = engine.world;
    
    // 衝突イベントの設定
    Matter.Events.on(engine, 'collisionStart', function(event) {
        console.log('Collision detected');
    });
    
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
    for (let g of grounds) {
        beginShape();
        for (let v of g.vertices) {
            vertex(v.x, v.y);
        }
        endShape(CLOSE);
    }
    
    // 車の描画と更新
    for (let car of cars) {
        car.display();
        car.update();
    }
    
    // 世代情報の表示
    fill(0);
    textSize(20);
    text(`Generation: ${currentGeneration}`, 20, 30);
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
            let x = this.x + cos(angle) * r;
            let y = this.y + sin(angle) * r;
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
        for (let i = 0; i < 2; i++) {
            let wheel = Matter.Bodies.circle(
                this.x + (i * 60 - 30),
                this.y + 30,
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
                pointA: { x: (i * 60 - 30), y: 30 },
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
        this.fitness = this.chassis.position.x;
        
        // 簡単な動力の追加
        Matter.Body.setAngularVelocity(this.wheels[0].body, 0.1);
        Matter.Body.setAngularVelocity(this.wheels[1].body, 0.1);
    }
}

function createTerrain() {
    let segments = 10;
    let points = [];
    
    for (let i = 0; i <= segments; i++) {
        let x = map(i, 0, segments, 0, width);
        let y = height - 100 + random(-30, 30);
        if (i === 0) y = height;
        if (i === segments) y = height;
        points.push({ x, y });
    }
    
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