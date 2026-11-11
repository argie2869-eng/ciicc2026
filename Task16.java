interface Animal {
    boolean feed(boolean timeToEat);
    void groom();
    void pet();
}

class Gorilla implements Animal {

    @Override
    public boolean feed(boolean timeToEat) {
        return timeToEat;
    }

    @Override
    public void groom() {
        System.out.println("Gorilla is being groomed.");
    }

    @Override
    public void pet() {
        System.out.println("Pet at your own risk!");
    }

    public static void main(String[] args) {
        Gorilla gorilla = new Gorilla();

        System.out.println(gorilla.feed(true));
        gorilla.groom();
        gorilla.pet();
    }
}