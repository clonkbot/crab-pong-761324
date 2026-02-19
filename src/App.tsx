import { Canvas } from '@react-three/fiber'
import { Suspense, useState, useRef, useEffect, useCallback } from 'react'
import { OrbitControls, Environment, Float, Text, ContactShadows, Stars } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Game constants
const ARENA_WIDTH = 12
const ARENA_HEIGHT = 8
const PADDLE_WIDTH = 2.5
const BALL_SPEED = 8
const PADDLE_SPEED = 10
const WINNING_SCORE = 5

// Crab Paddle Component
function CrabPaddle({ position, color, isAI = false, ballPosition }: {
  position: [number, number, number]
  color: string
  isAI?: boolean
  ballPosition: THREE.Vector3
}) {
  const groupRef = useRef<THREE.Group>(null!)
  const targetZ = useRef(position[2])
  const clawRef1 = useRef<THREE.Group>(null!)
  const clawRef2 = useRef<THREE.Group>(null!)

  useEffect(() => {
    if (!isAI) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'ArrowUp' || e.key === 'w') {
          targetZ.current = Math.max(targetZ.current - 0.5, -ARENA_HEIGHT / 2 + PADDLE_WIDTH / 2)
        }
        if (e.key === 'ArrowDown' || e.key === 's') {
          targetZ.current = Math.min(targetZ.current + 0.5, ARENA_HEIGHT / 2 - PADDLE_WIDTH / 2)
        }
      }
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isAI])

  useFrame((_, delta) => {
    if (!groupRef.current) return

    if (isAI) {
      // AI follows ball with some delay
      const targetAIZ = THREE.MathUtils.clamp(
        ballPosition.z,
        -ARENA_HEIGHT / 2 + PADDLE_WIDTH / 2,
        ARENA_HEIGHT / 2 - PADDLE_WIDTH / 2
      )
      groupRef.current.position.z = THREE.MathUtils.lerp(
        groupRef.current.position.z,
        targetAIZ,
        delta * 3
      )
    } else {
      // Player movement
      groupRef.current.position.z = THREE.MathUtils.lerp(
        groupRef.current.position.z,
        targetZ.current,
        delta * PADDLE_SPEED
      )
    }

    // Animate claws
    if (clawRef1.current && clawRef2.current) {
      const clawAngle = Math.sin(Date.now() * 0.005) * 0.3
      clawRef1.current.rotation.y = clawAngle
      clawRef2.current.rotation.y = -clawAngle
    }
  })

  return (
    <group ref={groupRef} position={position}>
      {/* Crab Body */}
      <mesh castShadow>
        <sphereGeometry args={[0.8, 32, 32]} />
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.2} />
      </mesh>

      {/* Eyes */}
      <mesh position={[0.3, 0.6, 0.3]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 0.4]} />
        <meshStandardMaterial color="#2a1a0a" />
      </mesh>
      <mesh position={[0.3, 0.8, 0.3]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh position={[-0.3, 0.6, 0.3]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 0.4]} />
        <meshStandardMaterial color="#2a1a0a" />
      </mesh>
      <mesh position={[-0.3, 0.8, 0.3]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color="#111" />
      </mesh>

      {/* Claws */}
      <group position={[0, 0, 0.9]} ref={clawRef1}>
        <mesh castShadow>
          <boxGeometry args={[0.4, 0.3, 0.8]} />
          <meshStandardMaterial color={color} roughness={0.3} />
        </mesh>
        <mesh position={[0.15, 0, 0.5]} castShadow>
          <boxGeometry args={[0.15, 0.25, 0.4]} />
          <meshStandardMaterial color={color} roughness={0.3} />
        </mesh>
        <mesh position={[-0.15, 0, 0.5]} castShadow>
          <boxGeometry args={[0.15, 0.25, 0.4]} />
          <meshStandardMaterial color={color} roughness={0.3} />
        </mesh>
      </group>
      <group position={[0, 0, -0.9]} rotation={[0, Math.PI, 0]} ref={clawRef2}>
        <mesh castShadow>
          <boxGeometry args={[0.4, 0.3, 0.8]} />
          <meshStandardMaterial color={color} roughness={0.3} />
        </mesh>
        <mesh position={[0.15, 0, 0.5]} castShadow>
          <boxGeometry args={[0.15, 0.25, 0.4]} />
          <meshStandardMaterial color={color} roughness={0.3} />
        </mesh>
        <mesh position={[-0.15, 0, 0.5]} castShadow>
          <boxGeometry args={[0.15, 0.25, 0.4]} />
          <meshStandardMaterial color={color} roughness={0.3} />
        </mesh>
      </group>

      {/* Legs */}
      {[-1, 1].map((side) => (
        [0.4, 0, -0.4].map((offset, i) => (
          <mesh key={`leg-${side}-${i}`} position={[side * 0.7, -0.3, offset]} rotation={[0, 0, side * 0.5]} castShadow>
            <cylinderGeometry args={[0.06, 0.04, 0.6]} />
            <meshStandardMaterial color={color} roughness={0.3} />
          </mesh>
        ))
      ))}
    </group>
  )
}

// Ball Component
function Ball({
  onScore,
  paddle1Ref,
  paddle2Ref,
  ballPositionRef,
  isPaused
}: {
  onScore: (player: 1 | 2) => void
  paddle1Ref: React.RefObject<THREE.Vector3>
  paddle2Ref: React.RefObject<THREE.Vector3>
  ballPositionRef: React.MutableRefObject<THREE.Vector3>
  isPaused: boolean
}) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const velocity = useRef(new THREE.Vector3(BALL_SPEED, 0, BALL_SPEED * 0.5))
  const trailRef = useRef<THREE.Points>(null!)

  useFrame((_, delta) => {
    if (!meshRef.current || isPaused) return

    const ball = meshRef.current

    // Update position
    ball.position.x += velocity.current.x * delta
    ball.position.z += velocity.current.z * delta

    // Update ball position ref for AI
    ballPositionRef.current.copy(ball.position)

    // Top/bottom wall collision
    if (ball.position.z > ARENA_HEIGHT / 2 - 0.3 || ball.position.z < -ARENA_HEIGHT / 2 + 0.3) {
      velocity.current.z *= -1
      ball.position.z = THREE.MathUtils.clamp(ball.position.z, -ARENA_HEIGHT / 2 + 0.3, ARENA_HEIGHT / 2 - 0.3)
    }

    // Paddle collision (left - player)
    if (ball.position.x < -ARENA_WIDTH / 2 + 1.5 && paddle1Ref.current) {
      if (Math.abs(ball.position.z - paddle1Ref.current.z) < PADDLE_WIDTH / 2 + 0.3) {
        velocity.current.x = Math.abs(velocity.current.x) * 1.05
        velocity.current.z += (ball.position.z - paddle1Ref.current.z) * 2
        ball.position.x = -ARENA_WIDTH / 2 + 1.5
      }
    }

    // Paddle collision (right - AI)
    if (ball.position.x > ARENA_WIDTH / 2 - 1.5 && paddle2Ref.current) {
      if (Math.abs(ball.position.z - paddle2Ref.current.z) < PADDLE_WIDTH / 2 + 0.3) {
        velocity.current.x = -Math.abs(velocity.current.x) * 1.05
        velocity.current.z += (ball.position.z - paddle2Ref.current.z) * 2
        ball.position.x = ARENA_WIDTH / 2 - 1.5
      }
    }

    // Score
    if (ball.position.x < -ARENA_WIDTH / 2 - 1) {
      onScore(2)
      ball.position.set(0, 0.5, 0)
      velocity.current.set(BALL_SPEED, 0, (Math.random() - 0.5) * BALL_SPEED)
    }
    if (ball.position.x > ARENA_WIDTH / 2 + 1) {
      onScore(1)
      ball.position.set(0, 0.5, 0)
      velocity.current.set(-BALL_SPEED, 0, (Math.random() - 0.5) * BALL_SPEED)
    }

    // Clamp velocity
    velocity.current.z = THREE.MathUtils.clamp(velocity.current.z, -BALL_SPEED * 1.5, BALL_SPEED * 1.5)

    // Spin the ball
    ball.rotation.x += delta * 5
    ball.rotation.z += delta * 3
  })

  return (
    <Float speed={2} rotationIntensity={0} floatIntensity={0.5}>
      <mesh ref={meshRef} position={[0, 0.5, 0]} castShadow>
        <sphereGeometry args={[0.3, 32, 32]} />
        <meshStandardMaterial
          color="#ffeb3b"
          emissive="#ff9800"
          emissiveIntensity={0.5}
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>
    </Float>
  )
}

// Arena Component
function Arena() {
  return (
    <group>
      {/* Floor - Sandy Beach */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
        <planeGeometry args={[ARENA_WIDTH + 4, ARENA_HEIGHT + 4]} />
        <meshStandardMaterial
          color="#f4d699"
          roughness={0.9}
        />
      </mesh>

      {/* Water effect around arena */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.48, 0]}>
        <ringGeometry args={[Math.max(ARENA_WIDTH, ARENA_HEIGHT) / 2 + 1, 20, 64]} />
        <meshStandardMaterial
          color="#0077be"
          transparent
          opacity={0.7}
          roughness={0.1}
        />
      </mesh>

      {/* Arena walls */}
      {/* Top wall */}
      <mesh position={[0, 0.3, -ARENA_HEIGHT / 2 - 0.25]} castShadow>
        <boxGeometry args={[ARENA_WIDTH + 1, 0.8, 0.5]} />
        <meshStandardMaterial color="#8d6e63" roughness={0.7} />
      </mesh>
      {/* Bottom wall */}
      <mesh position={[0, 0.3, ARENA_HEIGHT / 2 + 0.25]} castShadow>
        <boxGeometry args={[ARENA_WIDTH + 1, 0.8, 0.5]} />
        <meshStandardMaterial color="#8d6e63" roughness={0.7} />
      </mesh>

      {/* Center line */}
      <mesh position={[0, -0.49, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.1, ARENA_HEIGHT]} />
        <meshStandardMaterial color="#fff" transparent opacity={0.5} />
      </mesh>

      {/* Decorative shells */}
      {[[-5, -0.3, 3], [4, -0.3, -3], [-3, -0.3, -4], [5, -0.3, 4]].map((pos, i) => (
        <mesh key={i} position={pos as [number, number, number]} rotation={[0, Math.random() * Math.PI, 0]} castShadow>
          <coneGeometry args={[0.3, 0.4, 8]} />
          <meshStandardMaterial color={['#fff5ee', '#ffe4e1', '#ffdab9'][i % 3]} roughness={0.5} />
        </mesh>
      ))}
    </group>
  )
}

// Bubbles
function Bubbles() {
  const bubblesRef = useRef<THREE.Points>(null!)
  const count = 50

  const positions = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 20
    positions[i * 3 + 1] = Math.random() * 10
    positions[i * 3 + 2] = (Math.random() - 0.5) * 15
  }

  useFrame((_, delta) => {
    if (!bubblesRef.current) return
    const posArray = bubblesRef.current.geometry.attributes.position.array as Float32Array
    for (let i = 0; i < count; i++) {
      posArray[i * 3 + 1] += delta * 0.5
      if (posArray[i * 3 + 1] > 10) {
        posArray[i * 3 + 1] = 0
      }
    }
    bubblesRef.current.geometry.attributes.position.needsUpdate = true
  })

  return (
    <points ref={bubblesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial size={0.15} color="#87ceeb" transparent opacity={0.6} />
    </points>
  )
}

// Main Game Scene
function GameScene({
  onScore,
  isPaused
}: {
  onScore: (player: 1 | 2) => void
  isPaused: boolean
}) {
  const paddle1Ref = useRef<THREE.Vector3>(new THREE.Vector3(-ARENA_WIDTH / 2 + 1, 0.5, 0))
  const paddle2Ref = useRef<THREE.Vector3>(new THREE.Vector3(ARENA_WIDTH / 2 - 1, 0.5, 0))
  const ballPositionRef = useRef(new THREE.Vector3(0, 0.5, 0))

  useFrame(() => {
    // Update paddle position refs for collision detection
    const paddle1 = document.querySelector('[data-paddle="1"]')
    const paddle2 = document.querySelector('[data-paddle="2"]')
  })

  return (
    <>
      <Arena />
      <CrabPaddle
        position={[-ARENA_WIDTH / 2 + 1, 0.5, 0]}
        color="#e53935"
        ballPosition={ballPositionRef.current}
      />
      <CrabPaddle
        position={[ARENA_WIDTH / 2 - 1, 0.5, 0]}
        color="#1e88e5"
        isAI
        ballPosition={ballPositionRef.current}
      />
      <Ball
        onScore={onScore}
        paddle1Ref={paddle1Ref}
        paddle2Ref={paddle2Ref}
        ballPositionRef={ballPositionRef}
        isPaused={isPaused}
      />
      <Bubbles />

      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[10, 15, 5]}
        intensity={1.5}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={50}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
      />
      <pointLight position={[0, 5, 0]} intensity={0.5} color="#87ceeb" />

      <ContactShadows
        position={[0, -0.49, 0]}
        opacity={0.4}
        scale={20}
        blur={2}
        far={10}
      />

      <Stars radius={100} depth={50} count={1000} factor={4} saturation={0} fade speed={1} />
      <Environment preset="sunset" />
    </>
  )
}

// Score Display in 3D
function ScoreDisplay3D({ score1, score2 }: { score1: number; score2: number }) {
  return (
    <group position={[0, 5, 0]}>
      <Text
        position={[-2, 0, 0]}
        fontSize={1.5}
        color="#e53935"
        anchorX="center"
        anchorY="middle"
        font="https://fonts.gstatic.com/s/pressstart2p/v15/e3t4euO8T-267oIAQAu6jDQyK3nVivM.woff"
      >
        {score1}
      </Text>
      <Text
        position={[0, 0, 0]}
        fontSize={1}
        color="#fff"
        anchorX="center"
        anchorY="middle"
      >
        -
      </Text>
      <Text
        position={[2, 0, 0]}
        fontSize={1.5}
        color="#1e88e5"
        anchorX="center"
        anchorY="middle"
        font="https://fonts.gstatic.com/s/pressstart2p/v15/e3t4euO8T-267oIAQAu6jDQyK3nVivM.woff"
      >
        {score2}
      </Text>
    </group>
  )
}

// Main App
export default function App() {
  const [score1, setScore1] = useState(0)
  const [score2, setScore2] = useState(0)
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'gameover'>('menu')
  const [winner, setWinner] = useState<1 | 2 | null>(null)

  const handleScore = useCallback((player: 1 | 2) => {
    if (player === 1) {
      setScore1(prev => {
        const newScore = prev + 1
        if (newScore >= WINNING_SCORE) {
          setGameState('gameover')
          setWinner(1)
        }
        return newScore
      })
    } else {
      setScore2(prev => {
        const newScore = prev + 1
        if (newScore >= WINNING_SCORE) {
          setGameState('gameover')
          setWinner(2)
        }
        return newScore
      })
    }
  }, [])

  const startGame = () => {
    setScore1(0)
    setScore2(0)
    setWinner(null)
    setGameState('playing')
  }

  return (
    <div className="w-screen h-screen bg-gradient-to-b from-[#0a1628] via-[#0d2137] to-[#1a3a52] overflow-hidden relative">
      {/* 3D Canvas */}
      <Canvas
        shadows
        camera={{ position: [0, 12, 14], fov: 50 }}
        className="w-full h-full"
      >
        <Suspense fallback={null}>
          <GameScene
            onScore={handleScore}
            isPaused={gameState !== 'playing'}
          />
          <ScoreDisplay3D score1={score1} score2={score2} />
          <OrbitControls
            enablePan={false}
            minPolarAngle={Math.PI / 6}
            maxPolarAngle={Math.PI / 2.5}
            minDistance={10}
            maxDistance={25}
          />
        </Suspense>
      </Canvas>

      {/* UI Overlay */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Title */}
        <div className="absolute top-4 md:top-8 left-1/2 -translate-x-1/2 text-center">
          <h1
            className="text-3xl md:text-5xl lg:text-6xl font-bold tracking-wider"
            style={{
              fontFamily: "'Bangers', cursive",
              color: '#fff',
              textShadow: '3px 3px 0 #e53935, 6px 6px 0 #1e88e5, 0 0 30px rgba(255,235,59,0.5)',
              letterSpacing: '0.1em'
            }}
          >
            🦀 CRAB PONG 🦀
          </h1>
          <p
            className="text-xs md:text-sm mt-1 md:mt-2 tracking-widest uppercase"
            style={{
              fontFamily: "'Press Start 2P', monospace",
              color: '#ffeb3b',
              textShadow: '0 0 10px rgba(255,235,59,0.8)'
            }}
          >
            $CRABPONG Token
          </p>
        </div>

        {/* Score HUD */}
        {gameState === 'playing' && (
          <div className="absolute top-20 md:top-28 left-1/2 -translate-x-1/2 flex items-center gap-4 md:gap-8">
            <div className="text-center">
              <p className="text-[10px] md:text-xs text-red-400 uppercase tracking-wider" style={{ fontFamily: "'Press Start 2P', monospace" }}>You</p>
              <p className="text-2xl md:text-4xl font-bold text-red-500" style={{ fontFamily: "'Bangers', cursive" }}>{score1}</p>
            </div>
            <div className="w-px h-8 md:h-12 bg-white/30" />
            <div className="text-center">
              <p className="text-[10px] md:text-xs text-blue-400 uppercase tracking-wider" style={{ fontFamily: "'Press Start 2P', monospace" }}>AI</p>
              <p className="text-2xl md:text-4xl font-bold text-blue-500" style={{ fontFamily: "'Bangers', cursive" }}>{score2}</p>
            </div>
          </div>
        )}

        {/* Controls hint */}
        {gameState === 'playing' && (
          <div className="absolute bottom-16 md:bottom-20 left-1/2 -translate-x-1/2 text-center">
            <p
              className="text-[8px] md:text-xs text-white/60 tracking-wider"
              style={{ fontFamily: "'Press Start 2P', monospace" }}
            >
              <span className="hidden md:inline">W/S or ↑/↓ to move</span>
              <span className="md:hidden">Drag to rotate view</span>
            </p>
          </div>
        )}

        {/* Menu Overlay */}
        {gameState === 'menu' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm pointer-events-auto">
            <div
              className="text-center p-6 md:p-10 rounded-3xl mx-4"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
                border: '2px solid rgba(255,235,59,0.3)',
                boxShadow: '0 0 60px rgba(255,235,59,0.2), inset 0 0 60px rgba(255,235,59,0.05)'
              }}
            >
              <div className="text-4xl md:text-6xl mb-4">🦀</div>
              <h2
                className="text-2xl md:text-4xl mb-4 md:mb-6"
                style={{
                  fontFamily: "'Bangers', cursive",
                  color: '#ffeb3b',
                  textShadow: '2px 2px 0 #e53935'
                }}
              >
                Ready to Pinch?
              </h2>
              <p
                className="text-[10px] md:text-xs text-white/70 mb-6 md:mb-8 max-w-xs mx-auto"
                style={{ fontFamily: "'Press Start 2P', monospace", lineHeight: '1.8' }}
              >
                First to {WINNING_SCORE} wins!
              </p>
              <button
                onClick={startGame}
                className="px-6 md:px-10 py-3 md:py-4 text-sm md:text-lg font-bold uppercase tracking-wider rounded-full transition-all duration-300 hover:scale-110 active:scale-95"
                style={{
                  fontFamily: "'Bangers', cursive",
                  background: 'linear-gradient(135deg, #e53935 0%, #ff7043 100%)',
                  color: '#fff',
                  boxShadow: '0 4px 20px rgba(229,57,53,0.5), 0 0 40px rgba(229,57,53,0.3)',
                  border: '2px solid rgba(255,255,255,0.2)'
                }}
              >
                🎮 Start Game
              </button>
            </div>
          </div>
        )}

        {/* Game Over Overlay */}
        {gameState === 'gameover' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-auto">
            <div
              className="text-center p-6 md:p-10 rounded-3xl mx-4"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
                border: `2px solid ${winner === 1 ? 'rgba(229,57,53,0.5)' : 'rgba(30,136,229,0.5)'}`,
                boxShadow: `0 0 60px ${winner === 1 ? 'rgba(229,57,53,0.3)' : 'rgba(30,136,229,0.3)'}`
              }}
            >
              <div className="text-4xl md:text-6xl mb-4">
                {winner === 1 ? '🏆' : '😢'}
              </div>
              <h2
                className="text-2xl md:text-4xl mb-2"
                style={{
                  fontFamily: "'Bangers', cursive",
                  color: winner === 1 ? '#ffeb3b' : '#90caf9',
                  textShadow: `2px 2px 0 ${winner === 1 ? '#e53935' : '#1565c0'}`
                }}
              >
                {winner === 1 ? 'You Win!' : 'AI Wins!'}
              </h2>
              <p
                className="text-[10px] md:text-xs text-white/70 mb-6 md:mb-8"
                style={{ fontFamily: "'Press Start 2P', monospace" }}
              >
                {score1} - {score2}
              </p>
              <button
                onClick={startGame}
                className="px-6 md:px-10 py-3 md:py-4 text-sm md:text-lg font-bold uppercase tracking-wider rounded-full transition-all duration-300 hover:scale-110 active:scale-95"
                style={{
                  fontFamily: "'Bangers', cursive",
                  background: winner === 1
                    ? 'linear-gradient(135deg, #ffeb3b 0%, #ffc107 100%)'
                    : 'linear-gradient(135deg, #1e88e5 0%, #42a5f5 100%)',
                  color: winner === 1 ? '#1a1a1a' : '#fff',
                  boxShadow: winner === 1
                    ? '0 4px 20px rgba(255,235,59,0.5)'
                    : '0 4px 20px rgba(30,136,229,0.5)',
                  border: '2px solid rgba(255,255,255,0.2)'
                }}
              >
                🔄 Play Again
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="absolute bottom-2 md:bottom-4 left-0 right-0 text-center">
        <p
          className="text-[9px] md:text-xs text-white/40 tracking-wide"
          style={{ fontFamily: "'Press Start 2P', monospace" }}
        >
          Requested by @OxPaulius · Built by @clonkbot
        </p>
      </footer>
    </div>
  )
}
