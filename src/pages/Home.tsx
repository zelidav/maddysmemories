import { Link } from 'react-router-dom';
import { role } from '../lib/auth';
import FloralAccent from '../components/FloralAccent';
import PhotoCarousel from '../components/PhotoCarousel';

export default function Home() {
  const r = role();

  return (
    <div className="home">
      <PhotoCarousel intervalMs={6000} />
      <section className="home-hero">
        <img src="/maddy-avatar.jpg" alt="Maddy" className="hero-avatar" />
        <h1 className="serif italic">Welcome.</h1>
        <p className="muted">
          Recipes from the kitchen. Stories from a long, full life.
          A keepsake for the family.
        </p>
        {r === 'guest' && (
          <div className="btn-row" style={{ justifyContent: 'center' }}>
            <Link to="/login" className="btn btn-primary btn-large" style={{ maxWidth: 280 }}>
              Sign in
            </Link>
          </div>
        )}
      </section>

      {r === 'admin' && (
        <section className="home-cards">
          <Link to="/recipes" className="home-card">
            <FloralAccent variant="tulip" className="home-card-flora" />
            <h2>Recipes</h2>
            <p>Photograph the cards from your box. We'll read the handwriting and keep them safe.</p>
          </Link>
          <Link to="/journal" className="home-card">
            <FloralAccent variant="leaf" className="home-card-flora" />
            <h2>Journal</h2>
            <p>Write down memories, stories, the small things. A line a day, or a long letter.</p>
          </Link>
          <Link to="/family" className="home-card">
            <FloralAccent variant="daffodil" className="home-card-flora" />
            <h2>Family Hub</h2>
            <p>Share everything with the family — they can read and leave a note.</p>
          </Link>
        </section>
      )}

      {r === 'family' && (
        <section className="home-cards" style={{ gridTemplateColumns: '1fr', maxWidth: 540, margin: '0 auto' }}>
          <Link to="/family" className="home-card">
            <FloralAccent variant="daffodil" className="home-card-flora" />
            <h2>Open Grandma's Family Hub</h2>
            <p>Browse her recipes and stories, and leave a note.</p>
          </Link>
        </section>
      )}
    </div>
  );
}
